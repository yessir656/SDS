// ============================================================================
// POST /api/admin/sds/extract
//   AI-powered "Auto-fill from PDF" endpoint.
//
//   Accepts a multipart upload containing an SDS PDF file. The endpoint:
//     1. Validates the file (auth + magic bytes + MIME + extension + size).
//     2. Rasterizes the first 5 pages to PNG using a pure-JavaScript renderer
//        (pdfjs-dist + @napi-rs/canvas) — NO system dependencies required.
//     3. Base64-encodes each PNG.
//     4. Sends all images to the in-house VLM (z-ai-web-dev-sdk) with a
//        structured extraction prompt that maps SDS fields to our schema.
//     5. Parses the JSON response, validates enum values, sanitizes strings.
//     6. Returns { success: true, data: { ...fields } }.
//
//   Admin-only. Server-side authorization enforced via requireAdmin().
// ============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import {
  MAX_SDS_FILE_SIZE,
  ALLOWED_SDS_MIME_TYPES,
  ALLOWED_SDS_EXTENSIONS,
} from "@/lib/validation";
import { isPdf } from "@/lib/storage";
import { rasterizePdfToPngs } from "@/lib/pdf-rasterize";
import ZAI from "z-ai-web-dev-sdk";

// Allow this route up to 60s — VLM extraction of multi-page PDFs takes ~10-15s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
    const lower = String(item).toLowerCase().trim();
    if (valid.has(lower as T) && !seen.has(lower as T)) {
      seen.add(lower as T);
      out.push(lower as T);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ---------------------------------------------------------------------------
  // Parse multipart form data.
  // ---------------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "No file provided" },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------------------
  // File size check.
  // ---------------------------------------------------------------------------
  if (file.size === 0) {
    return NextResponse.json(
      { success: false, error: "File is empty" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SDS_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: `File too large. Maximum size is ${MAX_SDS_FILE_SIZE / (1024 * 1024)} MB`,
      },
      { status: 413 }
    );
  }

  // ---------------------------------------------------------------------------
  // Read file bytes for magic-byte validation.
  // ---------------------------------------------------------------------------
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Magic byte check: must start with %PDF-
  if (!isPdf(buffer)) {
    return NextResponse.json(
      { success: false, error: "File is not a valid PDF (magic bytes mismatch)" },
      { status: 400 }
    );
  }

  // MIME type check.
  if (!ALLOWED_SDS_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid MIME type. Allowed: ${ALLOWED_SDS_MIME_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Extension check.
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_SDS_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );
  if (!hasValidExt) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid file extension. Allowed: ${ALLOWED_SDS_EXTENSIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------------------
  // Rasterize the PDF to PNG images using a pure-JavaScript renderer.
  // No system dependencies (Poppler/pdftoppm) required — pdfjs-dist +
  // @napi-rs/canvas run entirely in-process.
  // ---------------------------------------------------------------------------
  let pageImages: string[];
  try {
    const pngBuffers = await rasterizePdfToPngs(buffer, {
      maxPages: 5,
      scale: 2.0, // ≈ 150 DPI on a standard 72 DPI PDF viewport
    });

    if (pngBuffers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "PDF rasterization produced no images. The PDF may be empty or corrupted.",
        },
        { status: 500 }
      );
    }

    // Base64-encode each PNG for the VLM image_url content blocks.
    pageImages = pngBuffers.map((b) => b.toString("base64"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to rasterize PDF: ${msg}`,
      },
      { status: 500 }
    );
  }

  // ---------------------------------------------------------------------------
  // Build the VLM message and call createVision.
  // ---------------------------------------------------------------------------
  let zai;
  try {
    zai = await ZAI.create();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The SDK throws this exact message when no .z-ai-config file is found in
    // any of the 3 search paths (project root, home dir, /etc). This happens
    // when the app is run outside the Z.ai cloud sandbox — the in-house VLM
    // service is only reachable from inside the sandbox.
    if (msg.includes("Configuration file not found")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI auto-fill is only available in the Z.ai cloud sandbox (the Preview Panel). The vision model service is not reachable from a local development machine. Please test this feature via the Preview Panel.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: `AI service unavailable: ${msg}` },
      { status: 502 }
    );
  }

  try {
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      { type: "text", text: EXTRACTION_PROMPT },
      ...pageImages.map((b64) => ({
        type: "image_url" as const,
        image_url: { url: `data:image/png;base64,${b64}` },
      })),
    ];

    let rawResponse: string;
    try {
      const resp = await zai.chat.completions.createVision({
        model: "glm-4.6v",
        messages: [{ role: "user", content }],
        thinking: { type: "disabled" },
      } as Parameters<typeof zai.chat.completions.createVision>[0]);
      rawResponse = resp?.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          success: false,
          error: `AI extraction failed: ${msg}`,
        },
        { status: 502 }
      );
    }

    if (!rawResponse) {
      return NextResponse.json(
        { success: false, error: "AI returned an empty response." },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------------------------
    // Parse + sanitize the VLM output.
    // ---------------------------------------------------------------------------
    let parsed: unknown = null;
    try {
      const jsonStr = extractJson(rawResponse);
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "AI response was not valid JSON.",
        },
        { status: 502 }
      );
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json(
        {
          success: false,
          error: "AI response was not a JSON object.",
        },
        { status: 502 }
      );
    }

    const obj = parsed as Record<string, unknown>;

    // Sanitize signalWord — default to "danger" if invalid.
    const rawSignal = asString(obj.signalWord).toLowerCase();
    const signalWord: "danger" | "warning" = VALID_SIGNAL_WORDS.has(rawSignal as "danger" | "warning")
      ? (rawSignal as "danger" | "warning")
      : "danger";

    // Sanitize pictograms + hazard classes against enum sets.
    const rawPictograms = asStringArray(obj.ghsPictograms);
    const ghsPictograms = filterValid(rawPictograms, VALID_GHS_PICTOGRAMS);

    const rawHazardClasses = asStringArray(obj.hazardClasses);
    const hazardClasses = filterValid(rawHazardClasses, VALID_HAZARD_CLASSES);

    const data = {
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

    return NextResponse.json({ success: true, data });
  } catch (err) {
    // Catch-all for any unhandled error in the VLM / parsing stages.
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Extraction failed: ${msg}` },
      { status: 500 }
    );
  }
}
