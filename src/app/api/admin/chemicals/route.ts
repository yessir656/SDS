// ============================================================================
// GET  /api/admin/chemicals — list ALL chemicals (including deleted) for admin
// POST /api/admin/chemicals — create a new chemical + placeholder SDS
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

  // Guard: ID must be unique.
  const existing = await db.chemical.findUnique({ where: { id: data.id } });
  if (existing) {
    return NextResponse.json(
      { error: "A chemical with this ID already exists" },
      { status: 409 }
    );
  }

  // Create the chemical + placeholder SDS in a transaction.
  const chemical = await db.$transaction(async (tx) => {
    const chem = await tx.chemical.create({
      data: {
        id: data.id,
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
      },
    });

    // Generate and store a placeholder PDF for this chemical.
    const pdfBuffer = generatePlaceholderPdf(chem.chemicalName);
    const storageKey = generateStorageKey();
    await saveFile(pdfBuffer, storageKey);

    const sds = await tx.sdsDocument.create({
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

    return { chem, sds };
  });

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: "chemical.create",
    entityType: "chemical",
    entityId: chemical.chem.id,
    summary: `Created chemical "${chemical.chem.chemicalName}"`,
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
