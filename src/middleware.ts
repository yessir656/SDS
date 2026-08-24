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
  // Protect /admin and all /admin/* routes EXCEPT /admin/login (the sign-in
  // page itself). The bare `/admin` URL is matched explicitly so unauthed
  // visitors get a server-side 307 redirect to /admin/login (previously the
  // matcher only caught subpaths like /admin/chemicals, leaving the bare
  // /admin URL to render a stuck "Redirecting…" page).
  matcher: ["/admin", "/admin/((?!login).*)"],
};
