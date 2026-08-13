// ============================================================================
// POST /api/admin/change-password
//
// Authenticated admin changes their own password. Clears the
// `passwordChangeRequired` flag on success so the user can reach the dashboard.
//
// Rules:
//   - Must be signed in (any admin role).
//   - Must supply currentPassword (verified against bcrypt hash) + newPassword.
//   - newPassword must be >= 8 chars, != current password.
//   - On success: passwordHash updated, passwordChangeRequired=false, audit logged.
// ============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { logAction, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    !session.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  // Reject if new password == current password.
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different from your current password" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify current password.
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  // Hash + update.
  const newHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      passwordChangeRequired: false,
    },
  });

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: "user.password-change",
    entityType: "user",
    entityId: user.id,
    summary: `${user.email} changed their own password`,
  });

  return NextResponse.json({ success: true });
}
