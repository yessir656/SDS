// ============================================================================
// POST /api/admin/sds/reextract
//   "Retry with AI on the attached PDF" — re-runs the extraction pipeline on
//   an SDS PDF that is ALREADY stored for a chemical. Used by the Edit
//   Chemical dialog so the admin can AI-re-extract fields without having to
//   re-upload the same document.
//
//   Body (JSON): { chemicalId: string }
//
//   The pipeline always runs with forceAI (the admin explicitly asked for the
//   vision model). Read-only — nothing is written to the database; the caller
//   decides which fields to keep and saves via the normal PUT endpoint.
//
//   Admin-only. Server-side authorization enforced via requireAdmin().
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getFile, isPdf } from "@/lib/storage";
import { extractSdsFieldsFromBuffer } from "@/lib/sds-extract";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { chemicalId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const chemicalId = typeof body.chemicalId === "string" ? body.chemicalId.trim() : "";
  if (!chemicalId) {
    return NextResponse.json(
      { success: false, error: "chemicalId is required" },
      { status: 400 }
    );
  }

  const chemical = await db.chemical.findUnique({
    where: { id: chemicalId },
    include: { sdsDocument: true },
  });
  if (!chemical || chemical.deletedAt) {
    return NextResponse.json(
      { success: false, error: "Chemical not found" },
      { status: 404 }
    );
  }

  const sds = chemical.sdsDocument;
  if (!sds || sds.status !== "available") {
    return NextResponse.json(
      {
        success: false,
        error:
          "No real SDS PDF is attached to this chemical yet — use Auto-fill from PDF to upload the document first.",
      },
      { status: 400 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = await getFile(sds.storageKey);
  } catch {
    return NextResponse.json(
      { success: false, error: "Stored SDS PDF could not be read from storage" },
      { status: 500 }
    );
  }

  if (!isPdf(buffer)) {
    return NextResponse.json(
      { success: false, error: "Stored SDS document is not a valid PDF" },
      { status: 500 }
    );
  }

  const result = await extractSdsFieldsFromBuffer(buffer, { forceAI: true });

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
