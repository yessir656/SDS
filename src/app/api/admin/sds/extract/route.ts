// ============================================================================
// POST /api/admin/sds/extract
//   "Auto-fill from PDF" endpoint — TIERED extraction pipeline.
//
//   Accepts a multipart upload containing an SDS PDF file. The endpoint:
//     1. Validates the file (auth + magic bytes + MIME + extension + size).
//     2. Runs the shared tiered pipeline (src/lib/sds-extract.ts):
//        embedded text → local OCR → vision AI fallback, or AI-only when the
//        admin requests it via forceAI ("Retry with AI").
//     3. Returns { success: true, data: {...fields}, method, notice? } where
//        method ∈ "embedded-text" | "ocr" | "ai".
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
import { extractSdsFieldsFromBuffer } from "@/lib/sds-extract";

// Allow this route up to 120s — OCR of 5 pages plus first-run language-data
// download can take longer than the old vision-only path.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

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
  // "Retry with AI" escape hatch — admin can bypass the free tiers entirely.
  // ---------------------------------------------------------------------------
  const forceAI =
    formData.get("forceAI") === "true" || formData.get("forceAI") === "1";

  const result = await extractSdsFieldsFromBuffer(buffer, { forceAI });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    data: result.data,
    method: result.method,
    ...(result.notice ? { notice: result.notice } : {}),
  });
}
