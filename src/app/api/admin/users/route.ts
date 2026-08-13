// ============================================================================
// GET  /api/admin/users   — list all admin users (SUPER_ADMIN only)
// POST /api/admin/users   — create a new admin user (SUPER_ADMIN only)
// ============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { logAction, auditContext } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — list every user (admin + super-admin). Never returns passwordHash.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      passwordChangeRequired: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.getTime() : null,
      createdAt: u.createdAt.getTime(),
      updatedAt: u.updatedAt.getTime(),
    })),
  });
}

// ---------------------------------------------------------------------------
// POST — create a new admin account.
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
  passwordChangeRequired: z.boolean().default(true),
});

export async function POST(request: Request) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  // Guard: email must be unique.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      email,
      name: data.name ?? null,
      passwordHash,
      role: data.role,
      passwordChangeRequired: data.passwordChangeRequired,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      passwordChangeRequired: true,
      createdAt: true,
    },
  });

  const ctx = auditContext(session, request);
  await logAction({
    ctx,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    summary: `Created ${user.role} account ${email}${data.name ? ` (${data.name})` : ""}${data.passwordChangeRequired ? " [password change required]" : ""}`,
    after: { email, name: data.name ?? null, role: data.role, passwordChangeRequired: data.passwordChangeRequired },
  });

  return NextResponse.json(
    {
      user: {
        ...user,
        createdAt: user.createdAt.getTime(),
      },
    },
    { status: 201 }
  );
}
