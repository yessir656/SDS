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
//
// STALE-JWT PROTECTION:
// NextAuth JWTs are valid for 30 days. Without a DB check, a downgraded or
// disabled admin would retain access until their JWT expired. To close this
// gap, `requireAdmin` / `requireSuperAdmin` re-verify the user's `disabled`,
// `role`, and `passwordChangeRequired` flags against the database on every
// call. A 60-second in-memory cache bounds the DB load (worst case: a revoked
// admin retains access for 60 seconds after the cache was last populated).
// ============================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Session } from "next-auth";

// ---------------------------------------------------------------------------
// In-memory cache for fresh user state. Bounds DB load from the per-request
// stale-JWT check. One entry per active admin user.
// ---------------------------------------------------------------------------

interface FreshUserState {
  disabled: boolean;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  passwordChangeRequired: boolean;
  fetchedAt: number;
}

const freshStateCache = new Map<string, FreshUserState>();
const FRESH_STATE_TTL_MS = 60_000; // 60 seconds

/**
 * Fetch the user's current `disabled`, `role`, and `passwordChangeRequired`
 * state from the database, with a 60-second in-memory cache to bound load.
 *
 * Returns `null` if the user no longer exists (deleted).
 */
async function getFreshUserState(
  userId: string
): Promise<FreshUserState | null> {
  const cached = freshStateCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < FRESH_STATE_TTL_MS) {
    return cached;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      disabled: true,
      role: true,
      passwordChangeRequired: true,
    },
  });

  if (!user) return null;

  const state: FreshUserState = {
    disabled: user.disabled,
    role: user.role as FreshUserState["role"],
    passwordChangeRequired: user.passwordChangeRequired,
    fetchedAt: Date.now(),
  };
  freshStateCache.set(userId, state);
  return state;
}

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

  // Stale-JWT defense: re-verify the user's state against the DB. This
  // catches role downgrades and account disables within 60 seconds (cache
  // TTL) — without this, a revoked admin would retain access for up to 30
  // days (the JWT maxAge).
  const fresh = await getFreshUserState(session.user.id);
  if (!fresh || fresh.disabled) return null;
  if (fresh.role !== "ADMIN" && fresh.role !== "SUPER_ADMIN") return null;
  if (fresh.passwordChangeRequired) return null;

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

  // Stale-JWT defense: re-verify the user's state against the DB. This is
  // especially important for SUPER_ADMIN routes — if a super-admin is
  // downgraded or disabled, we must revoke their elevated access quickly.
  const fresh = await getFreshUserState(session.user.id);
  if (!fresh || fresh.disabled) return null;
  if (fresh.role !== "SUPER_ADMIN") return null;
  if (fresh.passwordChangeRequired) return null;

  return session;
}

/**
 * Invalidate the cached fresh-state for a user. Call this after mutating a
 * user's `disabled`, `role`, or `passwordChangeRequired` flag so the next
 * request sees the change immediately (instead of waiting up to 60s for the
 * cache to expire).
 *
 * Exported for use by the user-management API routes.
 */
export function invalidateUserStateCache(userId: string): void {
  freshStateCache.delete(userId);
}
