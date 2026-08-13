// ============================================================================
// POST /api/admin/system/test-ai — test the AI provider connection (SUPER_ADMIN)
//
// Sends a minimal text-only prompt to the configured provider and returns
// ok/fail + latency + response preview. Does NOT send any image and does NOT
// touch the database.
// ============================================================================

import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/session";
import { testProviderConnection } from "@/lib/ai-vlm";
import { logAction, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await testProviderConnection();

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: "system.test-ai",
    entityType: "system",
    entityId: result.provider,
    summary: `Tested AI provider "${result.provider}" → ${result.ok ? "OK" : "FAILED"} (${result.latencyMs}ms)`,
    after: {
      ok: result.ok,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      error: result.error ?? null,
    },
  });

  return NextResponse.json(result);
}
