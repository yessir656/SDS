// ============================================================================
// POST /api/admin/sds/extract
//   AI-powered "Auto-fill from PDF" endpoint.
//
//   Accepts a multipart upload containing an SDS PDF file. The endpoint:
//     1. Validates the file (auth + magic bytes + MIME + extension + size).
//     2. Writes the PDF to a temp file in os.tmpdir().
//     3. Runs `pdftoppm -png -r 150 -l 5` to rasterize the first 5 pages.
//     4. Reads each PNG and base64-encodes it.
//     5. Sends all images to the in-house VLM (z-ai-web-dev-sdk) with a
//        structured extraction prompt that maps SDS fields to our schema.
//     6. Parses the JSON response, validates enum values, sanitizes strings.
//     7. Cleans up ALL temp files in a `finally` block.
//     8. Returns { success: true, data: { ...fields } }.
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
import { promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import crypto from "crypto";
import ZAI from "z-ai-web-dev-sdk";

const execFileAsync = promisify(execFile);

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

/** Delete a file if it exists (silent on ENOENT). */
async function safeUnlink(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      // Swallow — best-effort cleanup.
      console.warn(`Failed to delete temp file ${p}:`, (err as Error).message);
    }
  }
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
  // Write the PDF to a temp file and rasterize it with pdftoppm.
  // ---------------------------------------------------------------------------
  const uid = crypto.randomUUID();
  const tempPdf = path.join(os.tmpdir(), `sds-extract-${uid}.pdf`);
  const pngPrefix = path.join(os.tmpdir(), `sds-extract-${uid}`);
  const pngFiles: string[] = [];

  try {
    await fs.writeFile(tempPdf, buffer);

    // pdftoppm -png -r 150 -l 5 <pdf> <prefix>
    //   → generates <prefix>-1.png, <prefix>-2.png, ... (up to 5 pages)
    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r",
        "150",
        "-l",
        "5", // last page = 5
        tempPdf,
        pngPrefix,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Detect the most common failure — Poppler not installed — and give a
      // clear, actionable install hint instead of the raw ENOENT string.
      const isMissing = /ENOENT|not found|command not found/i.test(msg);
      return NextResponse.json(
        {
          success: false,
          error: isMissing
            ? "Poppler is not installed. The AI auto-fill feature needs the `pdftoppm` tool from Poppler to convert PDF pages into images. Install it and restart the dev server: macOS → `brew install poppler`; Debian/Ubuntu → `sudo apt-get install poppler-utils`; Windows → download from https://github.com/oschwartz10612/poppler-windows/releases and add the `bin` folder to PATH."
            : `Failed to rasterize PDF: ${msg}`,
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------------------------
    // Discover and read the generated PNG files.
    // pdftoppm zero-pads the page number suffix on multi-digit page counts,
    // but for ≤9 pages it emits `<prefix>-1.png`, `<prefix>-2.png`, etc.
    // Use a directory scan to robustly find them.
    // ---------------------------------------------------------------------------
    const tmpDir = os.tmpdir();
    const allEntries = await fs.readdir(tmpDir);
    const prefixBasename = path.basename(pngPrefix);
    for (const entry of allEntries) {
      // Match: <prefixBasename>-<digits>.png
      if (
        entry.startsWith(`${prefixBasename}-`) &&
        entry.endsWith(".png")
      ) {
        pngFiles.push(path.join(tmpDir, entry));
      }
    }

    // Sort numerically by the page number suffix so the VLM reads in order.
    pngFiles.sort((a, b) => {
      const ra = parseInt(a.match(/-(\d+)\.png$/)?.[1] ?? "0", 10);
      const rb = parseInt(b.match(/-(\d+)\.png$/)?.[1] ?? "0", 10);
      return ra - rb;
    });

    if (pngFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "PDF rasterization produced no images. The PDF may be empty or corrupted.",
        },
        { status: 500 }
      );
    }

    // Read each PNG as base64 (cap at 5 to be safe).
    const pageImages = await Promise.all(
      pngFiles.slice(0, 5).map(async (p) => {
        const b = await fs.readFile(p);
        return b.toString("base64");
      })
    );

    // ---------------------------------------------------------------------------
    // Build the VLM message and call createVision.
    // ---------------------------------------------------------------------------
    const zai = await ZAI.create();

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
  } finally {
    // ---------------------------------------------------------------------------
    // ALWAYS clean up temp files — never leave them on disk.
    // ---------------------------------------------------------------------------
    await safeUnlink(tempPdf);
    for (const p of pngFiles) {
      await safeUnlink(p);
    }
  }
}
