// ============================================================================
// SDS extraction pipeline — shared by:
//   • POST /api/admin/sds/extract   ("Auto-fill from PDF", admin uploads file)
//   • POST /api/admin/sds/reextract (Retry-with-AI on an already-stored PDF)
//
// TIERED EXTRACTION (free-first, AI as fallback):
//   • Tier 1 — Embedded text (src/lib/pdf-text.ts): digital PDFs carry their
//     own text layer; pdfjs-dist reads it instantly. Free, offline, exact
//     characters. Covers ~90% of SDS documents.
//   • Tier 2 — Local OCR (src/lib/ocr.ts): scanned/image-only PDFs get
//     rasterized and read locally by Tesseract.js. Free, unlimited quota.
//   • Tier 3 — Vision AI (src/lib/ai-vlm.ts): only used automatically when
//     the local tiers come up empty/garbage, or when the caller forces it
//     via forceAI ("Retry with AI").
//
// Field parsing for tiers 1-2 uses deterministic GHS heuristics
// (src/lib/sds-local-parse.ts); tier 3 uses the structured VLM prompt.
// ============================================================================

import {
  callVlm,
  resolveProvider,
  assertProviderConfigured,
  AiConfigError,
  AiRequestError,
} from "@/lib/ai-vlm";
import { rasterizePdfToPngs } from "@/lib/pdf-rasterize";
import { extractPdfText } from "@/lib/pdf-text";
import { ocrPngBuffers } from "@/lib/ocr";
import { parseSdsText, scoreParse } from "@/lib/sds-local-parse";

// ---------------------------------------------------------------------------
// Pipeline thresholds
// ---------------------------------------------------------------------------

/** Minimum characters of extracted text before we trust a local tier. */
const TEXT_MIN_CHARS = 200;

/** Minimum parse score (out of 5) before we skip the AI fallback. */
const PARSE_MIN_SCORE = 2;

// ---------------------------------------------------------------------------
// Valid enum value sets — used to sanitize VLM output.
// ---------------------------------------------------------------------------
const VALID_SIGNAL_WORDS = new Set(["danger", "warning"]);
const VALID_GHS_PICTOGRAMS = new Set([
  "exploding-bomb",
  "flame",
  "flame-on-circle",
  "gas",
  "corrosion",
  "skull-and-crossbones",
  "exclamation-mark",
  "health-hazard",
  "environment",
]);
const VALID_HAZARD_CLASSES = new Set([
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
]);

// ---------------------------------------------------------------------------
// VLM extraction prompt — describes the exact JSON shape we expect and
// provides the valid enum IDs so the model can map document terms to our IDs.
// ---------------------------------------------------------------------------
const EXTRACTION_PROMPT = `You are an expert at reading Safety Data Sheets (SDS) for laboratory chemicals.
You will receive one or more page images from an SDS PDF. Read the document carefully and extract the following fields.

Return ONLY a single JSON object (no markdown, no explanation, no prose). Use this exact shape:

{
  "chemicalName": "string — Section 1, product identifier",
  "casNumber": "string — Section 3 or 9, the CAS Registry Number (e.g. 67-64-1)",
  "formula": "string — Section 3 or 9, the chemical/molecular formula (use plain ASCII like C3H6O if Unicode subscripts are unavailable)",
  "tradeName": "string — Section 1, trade / commercial name if different from chemical name; empty string if none",
  "manufacturer": "string — Section 1 or 3, manufacturer name",
  "supplier": "string — Section 1, supplier/distributor name; empty string if same as manufacturer",
  "signalWord": "danger" | "warning" — Section 2, GHS signal word. MUST be exactly one of: "danger", "warning". Default to "danger" if unclear.",
  "ghsPictograms": ["array of GHS pictogram IDs from Section 2. Each item MUST be one of: exploding-bomb, flame, flame-on-circle, gas, corrosion, skull-and-crossbones, exclamation-mark, health-hazard, environment. Map common names: 'flame'=flammable, 'flame-on-circle'=oxidizing, 'corrosion'=corrosive, 'skull-and-crossbones'=acute toxicity, 'exclamation-mark'=irritant/harmful, 'health-hazard'=chronic health hazard, 'environment'=environmental hazard, 'gas'=compressed gas, 'exploding-bomb'=explosive. Use the ID, not the label."],
  "hazardClasses": ["array of hazard class IDs from Section 2. Each item MUST be one of: explosive, flammable, oxidizing, compressed-gas, corrosive, toxic, harmful, irritant, sensitizer, carcinogen, reproductive-toxicant, specific-target-organ-toxicity, environmentally-hazardous. Choose ALL that apply based on the H-statements."],
  "storageLocation": "string — Section 7, storage conditions/requirements summarized as a short location/cabinet hint (e.g. 'Flammables cabinet, cool dry place'); empty string if not specified",
  "safetyInstructions": "string — Section 7 + 8, safe handling & storage instructions as a short paragraph",
  "emergencyContact": "string — Section 1 or 16, emergency phone number / poison control / supplier emergency line; include country code if shown",
  "personalProtectiveEquipment": ["array of PPE items from Section 8. Each item is a short phrase (e.g. 'Chemical splash goggles', 'Nitrile gloves', 'Lab coat', 'Respirator (NIOSH-approved)'). One item per array element."],
  "firstAidMeasures": "string — Section 4, first-aid measures. Include sub-sections for Eye contact, Skin contact, Inhalation, Ingestion if present.",
  "firefightingMeasures": "string — Section 5, firefighting measures. Include suitable extinguishing media, specific hazards, protective equipment.",
  "accidentalReleaseMeasures": "string — Section 6, accidental release measures. Include personal precautions, environmental precautions, cleanup methods."
}

Important rules:
- Return ONLY the JSON object. Do not wrap it in markdown code fences.
- If a field is missing or not present in the document, use an empty string "" (or empty array [] for arrays). Do NOT invent data.
- For enum arrays (ghsPictograms, hazardClasses), only use the exact IDs listed above.
- Keep all string values concise but complete — preserve essential safety information.
- For CAS numbers, use the standard format with dashes (e.g. 67-64-1).
- For emergency measures sections, preserve the original structure with sub-sections separated by newlines.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown code fences and surrounding prose, return the JSON string. */
function extractJson(raw: string): string {
  let s = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }

  // If still not starting with `{`, find the first `{` and the last `}`.
  if (!s.startsWith("{")) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      s = s.slice(start, end + 1);
    }
  }
  return s;
}

/** Coerce an unknown value into a trimmed string (or "" if absent). */
function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Coerce an unknown value into a string[] (deduped + trimmed). */
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** Filter an array of strings down to only members of a valid set. */
function filterValid<T extends string>(arr: string[], valid: Set<T>): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const item of arr) {
    const s = String(item).toLowerCase().trim();
    if (valid.has(s as T) && !seen.has(s as T)) {
      seen.add(s as T);
      out.push(s as T);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared field sanitizer — normalizes BOTH AI JSON and local-parse output into
// the identical response shape (trimmed strings, valid enum arrays).
// ---------------------------------------------------------------------------
function sanitizeFields(obj: Record<string, unknown>) {
  // Sanitize signalWord — default to "danger" if invalid/absent.
  const rawSignal = asString(obj.signalWord).toLowerCase();
  const signalWord: "danger" | "warning" = VALID_SIGNAL_WORDS.has(rawSignal as "danger" | "warning")
    ? (rawSignal as "danger" | "warning")
    : "danger";

  // Sanitize pictograms + hazard classes against enum sets.
  const ghsPictograms = filterValid(asStringArray(obj.ghsPictograms), VALID_GHS_PICTOGRAMS);
  const hazardClasses = filterValid(asStringArray(obj.hazardClasses), VALID_HAZARD_CLASSES);

  return {
    chemicalName: asString(obj.chemicalName),
    casNumber: asString(obj.casNumber),
    formula: asString(obj.formula),
    tradeName: asString(obj.tradeName),
    manufacturer: asString(obj.manufacturer),
    supplier: asString(obj.supplier),
    signalWord,
    ghsPictograms,
    hazardClasses,
    storageLocation: asString(obj.storageLocation),
    safetyInstructions: asString(obj.safetyInstructions),
    emergencyContact: asString(obj.emergencyContact),
    personalProtectiveEquipment: asStringArray(obj.personalProtectiveEquipment),
    firstAidMeasures: asString(obj.firstAidMeasures),
    firefightingMeasures: asString(obj.firefightingMeasures),
    accidentalReleaseMeasures: asString(obj.accidentalReleaseMeasures),
  };
}

export type SdsFields = ReturnType<typeof sanitizeFields>;

export type ExtractMethod = "embedded-text" | "ocr" | "ai";

export type SdsExtractionResult =
  | { ok: true; data: SdsFields; method: ExtractMethod; notice?: string }
  | { ok: false; error: string; status: number };

// ---------------------------------------------------------------------------
// extractSdsFieldsFromBuffer — run the full tiered pipeline on a PDF buffer.
// ---------------------------------------------------------------------------
export async function extractSdsFieldsFromBuffer(
  buffer: Buffer,
  options: { forceAI?: boolean } = {}
): Promise<SdsExtractionResult> {
  const forceAI = options.forceAI === true;

  // Provider config is only needed when tier 3 actually runs — checked lazily
  // inside the tier-3 block so a missing/misconfigured key doesn't block the
  // free local pipeline.
  const provider = resolveProvider();

  // Shared rasterization helper (needed by OCR tier and the AI fallback).
  // Pure-JavaScript renderer — no system dependencies required.
  let pageImagesCache: Buffer[] | null = null;
  const getPageImages = async (): Promise<Buffer[]> => {
    if (!pageImagesCache) {
      pageImagesCache = await rasterizePdfToPngs(buffer, {
        maxPages: 5,
        scale: 2.0, // ≈ 150 DPI on a standard 72 DPI PDF viewport
      });
    }
    return pageImagesCache;
  };

  // -------------------------------------------------------------------------
  // TIERED EXTRACTION — free local tiers first.
  // -------------------------------------------------------------------------
  let parsedFields: ReturnType<typeof parseSdsText> | null = null;
  let method: "embedded-text" | "ocr" | null = null;
  let ocrNotice: string | null = null;

  if (!forceAI) {
    // ---- Tier 1: embedded text (digital PDFs) ------------------------------
    let textPages: string[] | null = null;
    let textChars = 0;
    try {
      const t = await extractPdfText(buffer, 5);
      textPages = t.pages;
      textChars = t.totalChars;
    } catch {
      // Corrupt/unreadable text layer — continue to Tier 2.
    }

    if (textPages && textChars >= TEXT_MIN_CHARS) {
      parsedFields = parseSdsText(textPages);
      method = "embedded-text";
    }

    // ---- Tier 2: local OCR (scanned/image-only PDFs) -----------------------
    // Runs when Tier 1 found nothing usable, OR when its parse came back too
    // weak to trust (e.g. a hybrid document where the useful content is an
    // image embedded in an otherwise digital page).
    if (!parsedFields || scoreParse(parsedFields) < PARSE_MIN_SCORE) {
      let pageImages: Buffer[];
      try {
        pageImages = await getPageImages();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Failed to rasterize PDF: ${msg}`, status: 500 };
      }
      if (pageImages.length === 0) {
        return {
          ok: false,
          error:
            "PDF rasterization produced no images. The PDF may be empty or corrupted.",
          status: 500,
        };
      }

      try {
        const ocr = await ocrPngBuffers(pageImages);
        if (ocr.totalChars >= TEXT_MIN_CHARS) {
          const ocrParsed = parseSdsText(ocr.pages);
          // Prefer whichever local result scored higher.
          if (!parsedFields || scoreParse(ocrParsed) > scoreParse(parsedFields)) {
            parsedFields = ocrParsed;
            method = "ocr";
          }
        }
      } catch (err) {
        // OCR engine failure (first-run language download blocked, etc.) —
        // remember why so the final response/notice can explain it, then fall
        // through to the AI tier below.
        const msg = `Local OCR unavailable: ${
          err instanceof Error ? err.message : String(err)
        }`;
        console.error("[sds-extract]", msg);
        ocrNotice = msg;
      }
      if (parsedFields && method === "ocr") {
        console.log(
          `[sds-extract] OCR tier scored ${scoreParse(parsedFields)}/5`
        );
      }
    }
  }

  const localScore = parsedFields ? scoreParse(parsedFields) : -1;

  // -------------------------------------------------------------------------
  // TIER 3: vision AI — automatic fallback when local parsing was weak, or
  // forced via the caller's "Retry with AI" request.
  // -------------------------------------------------------------------------
  let aiError: string | null = null;

  if (!parsedFields || localScore < PARSE_MIN_SCORE) {
    try {
      assertProviderConfigured(provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If we have ANY usable local data, prefer it over failing hard.
      if (!(parsedFields && localScore >= 1)) {
        return { ok: false, error: msg, status: 503 };
      }
      aiError = msg;
    }

    if (!aiError) {
      let rawResponse = "";
      try {
        const pageImages = await getPageImages();
        if (pageImages.length === 0) {
          return {
            ok: false,
            error:
              "PDF rasterization produced no images. The PDF may be empty or corrupted.",
            status: 500,
          };
        }
        const result = await callVlm(pageImages, EXTRACTION_PROMPT);
        rawResponse = result.text;
      } catch (err) {
        if (err instanceof AiConfigError) {
          aiError = err.message;
        } else if (err instanceof AiRequestError) {
          aiError = err.message;
        } else {
          aiError = err instanceof Error ? err.message : String(err);
        }
      }

      if (!aiError) {
        if (!rawResponse) {
          aiError = "AI returned an empty response.";
        } else {
          // Parse + validate the VLM JSON.
          try {
            const jsonStr = extractJson(rawResponse);
            const obj = JSON.parse(jsonStr) as Record<string, unknown>;
            if (
              typeof obj !== "object" ||
              obj === null ||
              Array.isArray(obj)
            ) {
              throw new Error("not an object");
            }
            const data = sanitizeFields(obj);
            return {
              ok: true,
              data,
              method: "ai",
              // If OCR ran but failed before this, tell the admin why the AI
              // tier was used (e.g. first-run language data download failed).
              ...(ocrNotice ? { notice: ocrNotice } : {}),
            };
          } catch {
            aiError = "AI response was not valid JSON.";
          }
        }
      }

      // AI failed but we hold a weak-but-nonempty local result — use it rather
      // than returning nothing, and surface what happened via `notice`.
      if (!(parsedFields && localScore >= 1)) {
        return { ok: false, error: aiError ?? "Extraction failed.", status: 502 };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Local-path response — sanitize through the same field normalizer used for
  // AI output so both pipelines return identical shapes/enums.
  // -------------------------------------------------------------------------
  const fields = parsedFields as NonNullable<typeof parsedFields>;
  const data = sanitizeFields({
    chemicalName: fields.chemicalName,
    casNumber: fields.casNumber,
    formula: fields.formula,
    tradeName: fields.tradeName,
    manufacturer: fields.manufacturer,
    supplier: fields.supplier,
    signalWord: fields.signalWord || undefined,
    ghsPictograms: fields.ghsPictograms,
    hazardClasses: fields.hazardClasses,
    storageLocation: fields.storageLocation,
    safetyInstructions: fields.safetyInstructions,
    emergencyContact: fields.emergencyContact,
    personalProtectiveEquipment: fields.personalProtectiveEquipment,
    firstAidMeasures: fields.firstAidMeasures,
    firefightingMeasures: fields.firefightingMeasures,
    accidentalReleaseMeasures: fields.accidentalReleaseMeasures,
  });

  const notice =
    [ocrNotice, aiError].filter(Boolean).join(" · ") || undefined;

  return {
    ok: true,
    data,
    method: method as "embedded-text" | "ocr",
    ...(notice ? { notice } : {}),
  };
}
