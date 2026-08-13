// ============================================================================
// GET /api/admin/audit — paginated audit-log listing (SUPER_ADMIN only)
//
// Query params:
//   ?cursor=<isoTime>  — pagination cursor (createdAt of the last row)
//   ?limit=<1..100>    — page size (default 50, max 100)
//   ?action=<prefix>   — filter by action prefix (e.g. "user." or "chemical.")
//   ?entityType=<val>  — filter by entity type
//   ?actorId=<val>     — filter by actor
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(Math.max(1, limitRaw || DEFAULT_LIMIT), MAX_LIMIT);
  const actionPrefix = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");
  const actorId = url.searchParams.get("actorId");

  // Build the where clause.
  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;
  if (actionPrefix) where.action = { startsWith: actionPrefix };

  // Cursor pagination: createdAt < cursor (newest-first ordering).
  if (cursor) {
    const cursorTime = new Date(cursor);
    if (!isNaN(cursorTime.getTime())) {
      where.createdAt = { lt: cursorTime };
    }
  }

  const entries = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1, // fetch one extra to determine if there's a next page
  });

  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  return NextResponse.json({
    entries: page.map((e) => ({
      id: e.id,
      actorId: e.actorId,
      actorEmail: e.actorEmail,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      summary: e.summary,
      before: e.before,
      after: e.after,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt.getTime(),
    })),
    nextCursor,
    hasMore,
  });
}
