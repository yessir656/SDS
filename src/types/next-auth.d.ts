// ============================================================================
// NextAuth type augmentation — adds `role` and `id` to the session/JWT.
// ============================================================================

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "ADMIN" | "USER";
      passwordChangeRequired?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USER";
    passwordChangeRequired?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USER";
    passwordChangeRequired?: boolean;
  }
}
