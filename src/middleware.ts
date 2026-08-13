// ============================================================================
// Middleware — protects /admin/* routes at the edge.
//
// This is DEFENSE-IN-DEPTH. The real authorization is server-side in every
// admin API route via requireAdmin(). Even if this middleware is bypassed,
// the API will return 401/403.
// ============================================================================

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    authorized: ({ token }) => {
      // Allow both SUPER_ADMIN and ADMIN to reach /admin/* pages.
      // API-level super-admin-only routes (users, audit) enforce the stricter
      // check server-side via requireSuperAdmin().
      return token?.role === "SUPER_ADMIN" || token?.role === "ADMIN";
    },
  },
});

export const config = {
  // Protect all /admin/* routes EXCEPT /admin/login (the sign-in page itself).
  matcher: ["/admin/((?!login).*)"],
};
