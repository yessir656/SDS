// ============================================================================
// Audit Log — append-only trail of every administrative mutation.
//
// Every create/update/delete on chemicals, SDS documents, and users calls
// logAction() to record what changed, who changed it, and when. Failures are
// swallowed (logged to stderr) so an audit-log problem can NEVER break the
// main operation the user is trying to perform.
// ============================================================================

import { db } from "@/lib/db";
import type { Session } from "next-auth";

/** Best-effort context carried alongside an audit entry. */
export interface AuditContext {
  actorId: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
}

/** Build an AuditContext from a NextAuth session + optional Request. */
export function auditContext(
  session: Session | null,
  request?: Request
): AuditContext {
  let ipAddress: string | null = null;
  if (request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      ipAddress = forwarded.split(",")[0].trim();
    } else {
      const realIp = request.headers.get("x-real-ip");
      if (realIp) ipAddress = realIp.trim();
    }
  }
  return {
    actorId: session?.user?.id ?? null,
    actorEmail: session?.user?.email ?? null,
    ipAddress,
  };
}

/**
 * Append a single audit-log entry. NEVER throws — failures are logged only.
 *
 * @example
 *   await logAction({
 *     ctx, action: "chemical.create", entityType: "chemical", entityId: chem.id,
 *     summary: `Created chemical "${chem.chemicalName}"`,
 *     after: { name: chem.chemicalName, cas: chem.casNumber },
 *   });
 */
export async function logAction(params: {
  ctx: AuditContext;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.ctx.actorId,
        actorEmail: params.ctx.actorEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        summary: params.summary,
        before: params.before ? JSON.stringify(params.before) : null,
        after: params.after ? JSON.stringify(params.after) : null,
        ipAddress: params.ctx.ipAddress,
      },
    });
  } catch (err) {
    // Audit-log failure must never break the main operation.
    console.error("[audit] failed to log:", err);
  }
}

/** Helper: snapshot a chemical's editable fields for the `before`/`after` JSON. */
export function snapshotChemical(c: {
  id: string;
  chemicalName: string;
  casNumber: string;
  formula: string;
  signalWord: string;
  manufacturer?: string;
  supplier?: string;
  storageLocation?: string;
  department?: string;
  version?: string;
  deletedAt?: Date | null;
}) {
  return {
    id: c.id,
    name: c.chemicalName,
    cas: c.casNumber,
    formula: c.formula,
    signalWord: c.signalWord,
    manufacturer: c.manufacturer ?? "",
    supplier: c.supplier ?? "",
    location: c.storageLocation ?? "",
    department: c.department ?? "",
    version: c.version ?? "",
    deleted: !!c.deletedAt,
  };
}
