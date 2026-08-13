// ============================================================================
// POST /api/admin/sds
//   Upload (or replace) an SDS PDF for a chemical.
//
//   Multipart form data:
//     - file:       the PDF file (validated by magic bytes, MIME, extension, size)
//     - chemicalId: the chemical to attach this SDS to
//
//   If the chemical already has an SDS:
//     - The old file is deleted from storage.
//     - A new file is stored with a fresh storage key.
//     - version is incremented.
//     - status becomes "available".
//
// Admin-only. Server-side authorization enforced via requireAdmin().
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  sdsUploadSchema,
  MAX_SDS_FILE_SIZE,
  ALLOWED_SDS_MIME_TYPES,
  ALLOWED_SDS_EXTENSIONS,
} from "@/lib/validation";
import {
  generateStorageKey,
  saveFile,
  deleteFile,
  computeHash,
  isPdf,
} from "@/lib/storage";
import { logAction, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // Parse multipart form data.
  // ---------------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const chemicalIdRaw = formData.get("chemicalId");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!chemicalIdRaw || typeof chemicalIdRaw !== "string") {
    return NextResponse.json({ error: "chemicalId is required" }, { status: 400 });
  }

  // Validate chemicalId.
  const parsedMeta = sdsUploadSchema.safeParse({ chemicalId: chemicalIdRaw });
  if (!parsedMeta.success) {
    return NextResponse.json({ error: "Invalid chemicalId" }, { status: 400 });
  }
  const { chemicalId } = parsedMeta.data;

  // ---------------------------------------------------------------------------
  // Validate the chemical exists and is not deleted.
  // ---------------------------------------------------------------------------
  const chemical = await db.chemical.findUnique({ where: { id: chemicalId } });
  if (!chemical || chemical.deletedAt) {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // File size check.
  // ---------------------------------------------------------------------------
  if (file.size > MAX_SDS_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_SDS_FILE_SIZE / (1024 * 1024)} MB` },
      { status: 413 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Read file bytes for magic-byte validation + hashing.
  // ---------------------------------------------------------------------------
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Magic byte check: must start with %PDF-
  if (!isPdf(buffer)) {
    return NextResponse.json(
      { error: "File is not a valid PDF (magic bytes mismatch)" },
      { status: 400 }
    );
  }

  // MIME type check.
  if (!ALLOWED_SDS_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid MIME type. Allowed: ${ALLOWED_SDS_MIME_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Extension check.
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_SDS_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasValidExt) {
    return NextResponse.json(
      { error: `Invalid file extension. Allowed: ${ALLOWED_SDS_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------------------
  // Store the file with a server-generated safe filename.
  // ---------------------------------------------------------------------------
  const storageKey = generateStorageKey();
  await saveFile(buffer, storageKey);

  const contentHash = computeHash(buffer);
  // Sanitize original filename for storage (strip path components).
  const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // ---------------------------------------------------------------------------
  // Upsert the SDS record. If one exists, delete the old file and increment version.
  // ---------------------------------------------------------------------------
  const existingSds = await db.sdsDocument.findUnique({
    where: { chemicalId },
  });

  let sds;
  if (existingSds) {
    // Delete the old file from storage.
    await deleteFile(existingSds.storageKey);

    sds = await db.sdsDocument.update({
      where: { chemicalId },
      data: {
        storageKey,
        originalFileName: safeOriginalName,
        fileSize: buffer.length,
        mimeType: "application/pdf",
        contentHash,
        status: "available",
        version: { increment: 1 },
        uploadedById: session.user.id,
      },
    });
  } else {
    sds = await db.sdsDocument.create({
      data: {
        chemicalId,
        storageKey,
        originalFileName: safeOriginalName,
        fileSize: buffer.length,
        mimeType: "application/pdf",
        contentHash,
        status: "available",
        version: 1,
        uploadedById: session.user.id,
      },
    });
  }

  // Bump the chemical's serverVersion so clients detect the SDS change on sync.
  await db.chemical.update({
    where: { id: chemicalId },
    data: {
      serverVersion: { increment: 1 },
      updatedById: session.user.id,
    },
  });

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: existingSds ? "sds.replace" : "sds.upload",
    entityType: "sds",
    entityId: sds.id,
    summary: `${existingSds ? "Replaced" : "Uploaded"} SDS for "${chemical.chemicalName}" (v${sds.version}, ${file.name})`,
    after: { chemicalId, version: sds.version, fileName: file.name, size: buffer.length },
  });

  return NextResponse.json({ success: true, sdsId: sds.id, version: sds.version });
}
