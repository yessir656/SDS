// ============================================================================
// DELETE /api/admin/sds/:id
//   Revert an SDS to placeholder status. The real PDF is deleted from storage
//   and a fresh placeholder PDF is generated.
//
// Admin-only. Server-side authorization enforced via requireAdmin().
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deleteFile, generateStorageKey, saveFile, computeHash } from "@/lib/storage";
import { generatePlaceholderPdf } from "@/lib/pdf-placeholder";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sds = await db.sdsDocument.findUnique({
    where: { id },
    include: { chemical: true },
  });
  if (!sds) {
    return NextResponse.json({ error: "SDS not found" }, { status: 404 });
  }
  if (sds.chemical.deletedAt) {
    return NextResponse.json({ error: "Chemical is deleted" }, { status: 400 });
  }

  // Delete the current real PDF from storage.
  await deleteFile(sds.storageKey);

  // Generate and store a fresh placeholder.
  const pdfBuffer = generatePlaceholderPdf(sds.chemical.chemicalName);
  const storageKey = generateStorageKey();
  await saveFile(pdfBuffer, storageKey);

  // Revert the SDS record to placeholder status and bump version.
  await db.sdsDocument.update({
    where: { id },
    data: {
      storageKey,
      originalFileName: "placeholder.pdf",
      fileSize: pdfBuffer.length,
      contentHash: computeHash(pdfBuffer),
      status: "placeholder",
      version: { increment: 1 },
      uploadedById: session.user.id,
    },
  });

  // Bump the chemical's serverVersion so clients detect the change.
  await db.chemical.update({
    where: { id: sds.chemicalId },
    data: {
      serverVersion: { increment: 1 },
      updatedById: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
