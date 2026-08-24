// ============================================================================
// PUT    /api/admin/chemicals/:id — update an existing chemical
// DELETE /api/admin/chemicals/:id — soft-delete a chemical (and cascade SDS)
//
// Admin-only. Server-side authorization enforced via requireAdmin().
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { updateChemicalSchema } from "@/lib/validation";
import { serializeChemical } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// PUT — update a chemical. Increments serverVersion for sync detection.
// ---------------------------------------------------------------------------

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.chemical.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateChemicalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Build the update payload — only fields that were provided.
  const updateData: Record<string, unknown> = {};
  if (data.casNumber !== undefined) updateData.casNumber = data.casNumber;
  if (data.chemicalName !== undefined) updateData.chemicalName = data.chemicalName;
  if (data.formula !== undefined) updateData.formula = data.formula;
  if (data.tradeName !== undefined) updateData.tradeName = data.tradeName || null;
  if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
  if (data.supplier !== undefined) updateData.supplier = data.supplier;
  if (data.signalWord !== undefined) updateData.signalWord = data.signalWord;
  if (data.hazardClasses !== undefined) updateData.hazardClasses = JSON.stringify(data.hazardClasses);
  if (data.ghsPictograms !== undefined) updateData.ghsPictograms = JSON.stringify(data.ghsPictograms);
  if (data.storageLocation !== undefined) updateData.storageLocation = data.storageLocation;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.safetyInstructions !== undefined) updateData.safetyInstructions = data.safetyInstructions;
  if (data.version !== undefined) updateData.version = data.version;
  if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact;
  if (data.personalProtectiveEquipment !== undefined)
    updateData.personalProtectiveEquipment = JSON.stringify(data.personalProtectiveEquipment);
  if (data.regulatoryTags !== undefined)
    updateData.regulatoryTags = JSON.stringify(data.regulatoryTags);
  if (data.firstAidMeasures !== undefined) updateData.firstAidMeasures = data.firstAidMeasures;
  if (data.firefightingMeasures !== undefined) updateData.firefightingMeasures = data.firefightingMeasures;
  if (data.accidentalReleaseMeasures !== undefined)
    updateData.accidentalReleaseMeasures = data.accidentalReleaseMeasures;

  // Always record who made the change and bump serverVersion for sync.
  updateData.updatedById = session.user.id;
  updateData.serverVersion = { increment: 1 };

  const updated = await db.chemical.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ chemical: serializeChemical(updated) });
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete a chemical. Sync propagates the delete to clients.
// The SDS is cascaded by Prisma's onDelete: Cascade.
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.chemical.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 });
  }

  // Soft-delete: set deletedAt, bump serverVersion so clients detect the change.
  await db.chemical.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      serverVersion: { increment: 1 },
      updatedById: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
