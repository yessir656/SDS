"use client";

// ============================================================================
// AdminSessionProvider — wraps the admin layout with NextAuth's SessionProvider.
// Required for useSession() to work in client components.
// ============================================================================

import { SessionProvider } from "next-auth/react";

export function AdminSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
