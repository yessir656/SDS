// ============================================================================
// PATCH  /api/admin/users/:id — update a user (role, name, disabled, password)
// DELETE /api/admin/users/:id — permanently delete a user
//
// SUPER_ADMIN only. Guards prevent a super-admin from locking themselves out:
//   • cannot change own role away from SUPER_ADMIN
//   • cannot disable or delete own account
//   • cannot delete the last remaining SUPER_ADMIN
// ============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { logAction, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// PATCH — update role / name / disabled / password.
// ---------------------------------------------------------------------------

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    role: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
    disabled: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Guard: a super-admin cannot downgrade their own role (lockout prevention).
  if (
    data.role !== undefined &&
    data.role !== "SUPER_ADMIN" &&
    id === session.user.id
  ) {
    return NextResponse.json(
      { error: "You cannot remove your own SUPER_ADMIN role" },
      { status: 400 }
    );
  }

  // Guard: a super-admin cannot disable themselves.
  if (data.disabled === true && id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot disable your own account" },
      { status: 400 }
    );
  }

  // Guard: cannot disable the last super-admin.
  if (
    data.disabled === true &&
    target.role === "SUPER_ADMIN" &&
    !target.disabled
  ) {
    const activeSuperAdmins = await db.user.count({
      where: { role: "SUPER_ADMIN", disabled: false },
    });
    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        { error: "Cannot disable the last active super-admin" },
        { status: 400 }
      );
    }
  }

  // Guard: cannot downgrade the last super-admin to admin.
  if (data.role === "ADMIN" && target.role === "SUPER_ADMIN") {
    const activeSuperAdmins = await db.user.count({
      where: { role: "SUPER_ADMIN", disabled: false },
    });
    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        { error: "Cannot downgrade the last active super-admin" },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.disabled !== undefined) updateData.disabled = data.disabled;
  if (data.password !== undefined) {
    updateData.passwordHash = await hashPassword(data.password);
  }

  const before = {
    name: target.name,
    role: target.role,
    disabled: target.disabled,
  };

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      lastLoginAt: true,
      updatedAt: true,
    },
  });

  const ctx = auditContext(session, request);
  const changes: string[] = [];
  if (data.name !== undefined) changes.push(`name → "${data.name}"`);
  if (data.role !== undefined) changes.push(`role → ${data.role}`);
  if (data.disabled !== undefined) changes.push(`disabled → ${data.disabled}`);
  if (data.password !== undefined) changes.push("password reset");

  await logAction({
    ctx,
    action: data.disabled === true ? "user.disable" : "user.update",
    entityType: "user",
    entityId: id,
    summary: `Updated ${target.email}: ${changes.join(", ")}`,
    before,
    after: {
      name: updated.name,
      role: updated.role,
      disabled: updated.disabled,
    },
  });

  return NextResponse.json({
    user: {
      ...updated,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.getTime() : null,
      updatedAt: updated.updatedAt.getTime(),
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE — permanently remove a user.
// ---------------------------------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Guard: cannot delete self.
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Guard: cannot delete the last active super-admin.
  if (target.role === "SUPER_ADMIN" && !target.disabled) {
    const activeSuperAdmins = await db.user.count({
      where: { role: "SUPER_ADMIN", disabled: false },
    });
    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last active super-admin" },
        { status: 400 }
      );
    }
  }

  await db.user.delete({ where: { id } });

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    summary: `Deleted ${target.role} account ${target.email}`,
    before: { email: target.email, name: target.name, role: target.role },
  });

  return NextResponse.json({ success: true });
}
