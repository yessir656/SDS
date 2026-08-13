// ============================================================================
// GET /api/admin/dashboard — admin overview statistics.
// Admin-only.
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const totalChemicals = await db.chemical.count({ where: { deletedAt: null } });
  const deletedChemicals = await db.chemical.count({ where: { deletedAt: { not: null } } });
  const availableSds = await db.sdsDocument.count({ where: { status: "available" } });
  const placeholderSds = await db.sdsDocument.count({ where: { status: "placeholder" } });
  const totalSds = availableSds + placeholderSds;

  // Chemicals by department.
  const allChemicals = await db.chemical.findMany({
    where: { deletedAt: null },
    select: { department: true, signalWord: true },
  });

  const byDepartment: Record<string, number> = {};
  const bySignalWord: Record<string, number> = {};
  for (const c of allChemicals) {
    byDepartment[c.department] = (byDepartment[c.department] ?? 0) + 1;
    bySignalWord[c.signalWord] = (bySignalWord[c.signalWord] ?? 0) + 1;
  }

  // Recent activity (last 10 updates).
  const recent = await db.chemical.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      chemicalName: true,
      updatedAt: true,
      serverVersion: true,
      updatedBy: { select: { email: true } },
      sdsDocument: { select: { status: true, version: true } },
    },
  });

  return NextResponse.json({
    totalChemicals,
    deletedChemicals,
    totalSds,
    availableSds,
    placeholderSds,
    byDepartment,
    bySignalWord,
    recent: recent.map((r) => ({
      id: r.id,
      chemicalName: r.chemicalName,
      updatedAt: r.updatedAt.getTime(),
      serverVersion: r.serverVersion,
      updatedByEmail: r.updatedBy?.email ?? null,
      sdsStatus: r.sdsDocument?.status ?? "none",
      sdsVersion: r.sdsDocument?.version ?? 0,
    })),
  });
}
