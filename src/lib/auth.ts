// ============================================================================
// Auth — NextAuth configuration with Credentials provider + bcrypt hashing.
// ============================================================================

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const BCRYPT_ROUNDS = 12;

/** Hash a plaintext password for storage. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a stored hash. */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Guard: require both fields.
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const user = await db.user.findUnique({ where: { email } });

        // Guard: user must exist AND be an admin (either SUPER_ADMIN or ADMIN).
        // A "USER" role record cannot log in here — this endpoint is admin-only.
        if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return null;

        // Guard: super-admin can disable an account without deleting it.
        if (user.disabled) return null;

        const valid = await verifyPassword(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        // Record the login time for the user-management dashboard.
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => { /* non-critical */ });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role as "SUPER_ADMIN" | "ADMIN" | "USER",
          passwordChangeRequired: user.passwordChangeRequired,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // `user` is only present on first sign-in; persist id + role into JWT.
      if (user) {
        token.id = user.id;
        token.role = (user as { role: "SUPER_ADMIN" | "ADMIN" | "USER" }).role;
        token.passwordChangeRequired = (user as { passwordChangeRequired?: boolean }).passwordChangeRequired;
      }
      // When the client calls useSession().update(), re-fetch the user's
      // passwordChangeRequired flag from the DB so a just-completed password
      // change is reflected without requiring a fresh sign-in.
      if (trigger === "update" && token.id) {
        const fresh = await db.user.findUnique({
          where: { id: token.id },
          select: { passwordChangeRequired: true, role: true },
        });
        if (fresh) {
          token.passwordChangeRequired = fresh.passwordChangeRequired;
          token.role = fresh.role as "SUPER_ADMIN" | "ADMIN" | "USER";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.passwordChangeRequired = token.passwordChangeRequired;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.csrf-token"
          : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  // Use NEXTAUTH_SECRET if provided; otherwise NextAuth generates one (dev only).
  secret: process.env.NEXTAUTH_SECRET,
};

// Trust the request's Host header so auth works on any host (localhost:3000,
// LAN IP, tunnel) without a hardcoded NEXTAUTH_URL. NOTE: NextAuth v4's
// TypeScript types don't declare `trustHost` (it's a v5 concept) — the v4
// runtime keys off NEXTAUTH_URL, with host validation relaxed when unset.
// Set via assertion so this one untyped option doesn't force the whole
// authOptions object to `any` (and so `next build` type-checking passes).
(authOptions as { trustHost?: boolean }).trustHost = true;
