"use client";

// ============================================================================
// PasswordGuard — client-side redirect for the passwordChangeRequired flag.
//
// Mounted inside the admin layout. If the current path is NOT /admin/login
// and NOT /admin/change-password, and the signed-in user has
// passwordChangeRequired === true, redirect them to /admin/change-password.
//
// This is enforced client-side because the JWT custom claim is most easily
// read here. The API routes also independently reject requests from users
// with passwordChangeRequired via requireAdmin() — defense in depth.
// ============================================================================

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export function PasswordGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait until the session is loaded.
    if (status !== "authenticated" || !session?.user) return;

    // Don't redirect from the login page (user isn't fully signed in yet)
    // or from the change-password page itself.
    if (pathname === "/admin/login" || pathname === "/admin/change-password") {
      return;
    }

    if (session.user.passwordChangeRequired) {
      router.replace("/admin/change-password");
    }
  }, [status, session, pathname, router]);

  return <>{children}</>;
}
