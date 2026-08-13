// ============================================================================
// Session helpers — server-side authorization for the 3-tier role hierarchy.
//
//   SUPER_ADMIN  — full system access (user mgmt, audit log, everything)
//   ADMIN        — chemicals + SDS only (no user mgmt, no audit log)
//   USER         — public PWA only (cannot sign in to /admin)
//
// Users with `passwordChangeRequired === true` are blocked from all admin
// API routes EXCEPT /api/admin/change-password (which is handled separately
// and checks the flag inline). This is defense-in-depth — the client-side
// PasswordGuard also redirects them to the change-password page.
// ============================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";

/**
 * Returns the current session only if the user is an authenticated admin
 * (either SUPER_ADMIN or ADMIN) AND has already changed their password if
 * required. Returns `null` otherwise.
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
  // Block users who haven't completed the required password change.
  if (session.user.passwordChangeRequired) {
    return null;
  }
  return session;
}

/**
 * Returns the current session only if the user is a SUPER_ADMIN AND has
 * already changed their password if required. Returns `null` otherwise.
 *
 * Use this in user-management, audit-log, and system-settings API handlers.
 */
export async function requireSuperAdmin(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }
  // Block users who haven't completed the required password change.
  if (session.user.passwordChangeRequired) {
    return null;
  }
  return session;
}

