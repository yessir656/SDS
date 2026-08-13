// ============================================================================
// Session helper — server-side admin authorization.
// ============================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

/**
 * Returns the current session only if the user is an authenticated admin.
 * Returns `null` for unauthenticated requests or non-admin users.
 *
 * Use this in every admin API route handler to enforce server-side authz.
 * Never rely on client-side route protection alone.
 */
export async function requireAdmin(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}
