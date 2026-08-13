// ============================================================================
// Session helpers — server-side authorization for the 3-tier role hierarchy.
//
//   SUPER_ADMIN  — full system access (user mgmt, audit log, everything)
//   ADMIN        — chemicals + SDS only (no user mgmt, no audit log)
//   USER         — public PWA only (cannot sign in to /admin)
// ============================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

/**
 * Returns the current session only if the user is an authenticated admin
 * (either SUPER_ADMIN or ADMIN). Returns `null` for unauthenticated requests
 * or non-admin users.
 *
 * Use this in chemical / SDS API route handlers.
 */
export async function requireAdmin(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    !session.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
  ) {
    return null;
  }
  return session;
}

/**
 * Returns the current session only if the user is a SUPER_ADMIN.
 * Returns `null` for unauthenticated requests, ADMIN, or USER roles.
 *
 * Use this in user-management, audit-log, and system-settings API handlers.
 */
export async function requireSuperAdmin(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }
  return session;
}
