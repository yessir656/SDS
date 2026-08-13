// ============================================================================
// GET /api/chemicals
//   Public — returns all non-deleted chemicals (for initial client load).
// GET /api/chemicals/:id
//   Public — returns a single chemical by ID.
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeChemical } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const chemicals = await db.chemical.findMany({
    where: { deletedAt: null },
    orderBy: { chemicalName: "asc" },
  });
  return NextResponse.json({
    chemicals: chemicals.map(serializeChemical),
  });
}
