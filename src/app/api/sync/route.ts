// ============================================================================
// GET /api/sync?since=<epoch-ms>
// ============================================================================
//
// Public endpoint (no auth) — returns all chemicals and SDS documents whose
// updatedAt > since, plus IDs of records soft-deleted since then.
//
// The client calls this on app startup, on offline→online transition, and
// periodically while online. Only changed records are returned.
//
// Response shape:
// {
//   serverTime: number,           // current server epoch-ms (becomes the next `since`)
//   chemicals: ClientChemical[],  // added/updated since `since`
//   sdsDocuments: ClientSdsDocument[],
//   deletedChemicalIds: string[], // soft-deleted since `since`
//   deletedSdsIds: string[]
// }
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeChemical, serializeSds } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? parseInt(sinceParam, 10) : 0;

  // Guard against invalid `since` values.
  const sinceDate = Number.isFinite(since) && since > 0 ? new Date(since) : new Date(0);

  // Fetch changed chemicals (including soft-deleted ones).
  const changedChemicals = await db.chemical.findMany({
    where: { updatedAt: { gt: sinceDate } },
    orderBy: { updatedAt: "asc" },
  });

  // Fetch changed SDS documents.
  const changedSds = await db.sdsDocument.findMany({
    where: { updatedAt: { gt: sinceDate } },
    orderBy: { updatedAt: "asc" },
  });

  // For deletes: we identify chemicals that were soft-deleted since `since`.
  // SDS deletes cascade from chemical deletes in Prisma, so we only need
  // chemical deletes. If an SDS is explicitly deleted (admin removes SDS),
  // it shows up as a chemical with status change — but for simplicity, we
  // treat SDS deletion as "revert to placeholder" rather than hard delete.
  const deletedChemicals = await db.chemical.findMany({
    where: {
      deletedAt: { gt: sinceDate },
    },
    select: { id: true },
  });

  const chemicals = changedChemicals.map(serializeChemical);
  const sdsDocuments = changedSds.map(serializeSds);
  const deletedChemicalIds = deletedChemicals.map((c) => c.id);

  return NextResponse.json({
    serverTime: Date.now(),
    chemicals,
    sdsDocuments,
    deletedChemicalIds,
    deletedSdsIds: [] as string[],
  });
}
