// ============================================================================
// GET  /api/admin/chemicals — list ACTIVE chemicals (soft-deleted tombstones
//                              are hidden; they exist only so /api/sync can
//                              propagate deletions to PWA clients)
// POST /api/admin/chemicals — create a new chemical + placeholder SDS.
//                              Re-adding an id that only has a soft-deleted
//                              tombstone RESTORES that chemical instead.
//
// Admin-only. Server-side authorization enforced via requireAdmin().
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { createChemicalSchema } from "@/lib/validation";
import { serializeChemical, serializeSds } from "@/lib/serialize";
import { generateStorageKey, saveFile, computeHash } from "@/lib/storage";
import { generatePlaceholderPdf } from "@/lib/pdf-placeholder";
import { logAction, auditContext, snapshotChemical } from "@/lib/audit";
import { generateChemicalId } from "@/lib/slug";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — list all chemicals with their SDS metadata for the admin dashboard.
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chemicals = await db.chemical.findMany({
    where: { deletedAt: null },
    orderBy: { chemicalName: "asc" },
    include: { sdsDocument: true, updatedBy: true },
  });

  return NextResponse.json({
    chemicals: chemicals.map((c) => ({
      ...serializeChemical(c),
      sds: c.sdsDocument ? serializeSds(c.sdsDocument) : null,
      updatedByName: c.updatedBy?.email ?? null,
      createdAt: c.createdAt.getTime(),
    })),
  });
}

// ---------------------------------------------------------------------------
// POST — create a new chemical with a placeholder SDS.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createChemicalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // ---------------------------------------------------------------------
  // Auto-generate the ID if the admin left it blank.
  // Format: "{chemicalName}-{manufacturer}" → "aceticacid-fisher".
  // Falls back to the chemical name alone when no manufacturer is set.
  // ---------------------------------------------------------------------
  let finalId = data.id;
  if (!finalId) {
    finalId = generateChemicalId(data.chemicalName, data.manufacturer);
    if (!finalId) {
      // The chemical name slugified to empty (e.g. name was "!!!" only).
      // Last-resort fallback so the DB unique constraint doesn't 500.
      finalId = `chem-${Date.now().toString(36)}`;
    }
  }

  // ---------------------------------------------------------------------
  // Resolve the ID against existing records (active OR soft-deleted).
  //
  // - Soft-deleted tombstone with this ID  → RESTORE it (overwrite fields,
  //   clear the tombstone, bump serverVersion). This is the existing "undo
  //   delete by re-adding" contract.
  // - Active record with this ID           → COLLISION. Auto-suffix with
  //   -2, -3, … (-1 is the base). This means two "Acetic Acid" + "Fisher"
  //   records become "aceticacid-fisher" and "aceticacid-fisher-2". Tries
  //   up to 99 suffixes before giving up and returning 409.
  // ---------------------------------------------------------------------
  let existing = await db.chemical.findUnique({ where: { id: finalId } });
  let suffixAttempt = 1;
  while (existing && !existing.deletedAt) {
    suffixAttempt++;
    if (suffixAttempt > 99) {
      return NextResponse.json(
        {
          error: `A chemical with this ID already exists (tried ${finalId} through ${finalId}-99)`,
        },
        { status: 409 }
      );
    }
    finalId = `${data.id || generateChemicalId(data.chemicalName, data.manufacturer)}-${suffixAttempt}`;
    existing = await db.chemical.findUnique({ where: { id: finalId } });
  }

  const fields = {
    casNumber: data.casNumber,
    chemicalName: data.chemicalName,
    formula: data.formula,
    tradeName: data.tradeName || null,
    manufacturer: data.manufacturer,
    supplier: data.supplier,
    signalWord: data.signalWord,
    hazardClasses: JSON.stringify(data.hazardClasses),
    ghsPictograms: JSON.stringify(data.ghsPictograms),
    storageLocation: data.storageLocation,
    department: data.department,
    safetyInstructions: data.safetyInstructions,
    version: data.version,
    emergencyContact: data.emergencyContact,
    personalProtectiveEquipment: JSON.stringify(data.personalProtectiveEquipment),
    regulatoryTags: JSON.stringify(data.regulatoryTags ?? []),
    firstAidMeasures: data.firstAidMeasures,
    firefightingMeasures: data.firefightingMeasures,
    accidentalReleaseMeasures: data.accidentalReleaseMeasures,
    updatedById: session.user.id,
  };

  // Create the chemical + placeholder SDS in a transaction. If a soft-deleted
  // chemical already owns this id, restore it instead: overwrite the fields,
  // clear the tombstone, and bump serverVersion so clients re-sync it as
  // active (clients that removed it locally re-add it from the delta feed).
  const chemical = await db.$transaction(async (tx) => {
    const chem = existing
      ? await tx.chemical.update({
          where: { id: existing.id },
          data: { ...fields, deletedAt: null, serverVersion: { increment: 1 } },
        })
      : await tx.chemical.create({
          data: { id: finalId, ...fields },
        });

    // Fresh creates get a generated placeholder PDF. A restored chemical keeps
    // whatever SDS row survived its deletion — auto-fill attaches the picked
    // PDF right after save, which replaces it.
    let sds = await tx.sdsDocument.findUnique({ where: { chemicalId: chem.id } });
    if (!sds) {
      const pdfBuffer = generatePlaceholderPdf(chem.chemicalName);
      const storageKey = generateStorageKey();
      await saveFile(pdfBuffer, storageKey);

      sds = await tx.sdsDocument.create({
        data: {
          chemicalId: chem.id,
          storageKey,
          originalFileName: "placeholder.pdf",
          fileSize: pdfBuffer.length,
          mimeType: "application/pdf",
          contentHash: computeHash(pdfBuffer),
          status: "placeholder",
          version: 1,
        },
      });
    }

    return { chem, sds };
  });

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: existing ? "chemical.restore" : "chemical.create",
    entityType: "chemical",
    entityId: chemical.chem.id,
    summary: existing
      ? `Restored chemical "${chemical.chem.chemicalName}" (re-added after delete)`
      : `Created chemical "${chemical.chem.chemicalName}"`,
    after: snapshotChemical(chemical.chem),
  });

  return NextResponse.json(
    {
      // Attach the freshly-created SDS as the sdsDocument relation so
      // serializeChemical can populate sdsDocumentId with the real SDS cuid
      // (the chem object from the transaction doesn't include the relation).
      chemical: serializeChemical({ ...chemical.chem, sdsDocument: chemical.sds }),
      sds: serializeSds(chemical.sds),
    },
    { status: 201 }
  );
}