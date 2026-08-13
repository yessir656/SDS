// ============================================================================
// GET /api/admin/system/info — read-only system info dashboard (SUPER_ADMIN only)
//
// Returns:
//   - ai:           provider, model, key configured, sdk installed, hint, notes
//   - storage:      total bytes, file count, dir path, largest file
//   - sync:         chemical + SDS counts, last update time, server version max
//   - database:     SQLite file size, path, row counts per table
//   - system:       node version, next.js version, environment, uptime, time
// ============================================================================

import { NextResponse } from "next/server";
import { promises as fs, existsSync as fsExistsSync, readFileSync as fsReadFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { getProviderInfo } from "@/lib/ai-vlm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // -----------------------------------------------------------------------
  // AI provider info (sync — no API call, just env introspection)
  // -----------------------------------------------------------------------
  const ai = getProviderInfo();

  // -----------------------------------------------------------------------
  // Storage info — walk the storage/sds directory
  // -----------------------------------------------------------------------
  const storageDir = path.join(process.cwd(), "storage", "sds");
  let storage = {
    dir: storageDir,
    totalBytes: 0,
    fileCount: 0,
    largestFile: null as null | { name: string; size: number },
    averageBytes: 0,
  };
  try {
    const entries = await fs.readdir(storageDir);
    let total = 0;
    let count = 0;
    let largest: { name: string; size: number } | null = null;
    for (const name of entries) {
      const full = path.join(storageDir, name);
      const stat = await fs.stat(full);
      if (stat.isFile()) {
        total += stat.size;
        count += 1;
        if (!largest || stat.size > largest.size) {
          largest = { name, size: stat.size };
        }
      }
    }
    storage = {
      dir: storageDir,
      totalBytes: total,
      fileCount: count,
      largestFile: largest,
      averageBytes: count > 0 ? Math.round(total / count) : 0,
    };
  } catch {
    // storage dir doesn't exist yet — leave defaults
  }

  // -----------------------------------------------------------------------
  // Sync / data info
  // -----------------------------------------------------------------------
  const [
    totalChemicals,
    deletedChemicals,
    availableSds,
    placeholderSds,
    totalUsers,
    totalAuditLogs,
    lastUpdatedChemical,
  ] = await Promise.all([
    db.chemical.count({ where: { deletedAt: null } }),
    db.chemical.count({ where: { deletedAt: { not: null } } }),
    db.sdsDocument.count({ where: { status: "available" } }),
    db.sdsDocument.count({ where: { status: "placeholder" } }),
    db.user.count(),
    db.auditLog.count(),
    db.chemical.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, serverVersion: true },
    }),
  ]);

  const sync = {
    totalChemicals,
    deletedChemicals,
    availableSds,
    placeholderSds,
    totalSds: availableSds + placeholderSds,
    totalUsers,
    totalAuditLogs,
    lastUpdatedAt: lastUpdatedChemical?.updatedAt.getTime() ?? null,
    maxServerVersion: lastUpdatedChemical?.serverVersion ?? 0,
  };

  // -----------------------------------------------------------------------
  // Database info — SQLite file size
  // -----------------------------------------------------------------------
  const dbPath = path.join(process.cwd(), "db", "custom.db");
  let dbSize = 0;
  try {
    const stat = await fs.stat(dbPath);
    dbSize = stat.size;
  } catch {
    // db file might not exist yet
  }

  const database = {
    type: "sqlite",
    path: dbPath,
    sizeBytes: dbSize,
    url: process.env.DATABASE_URL ?? "(not set)",
  };

  // -----------------------------------------------------------------------
  // System info
  // -----------------------------------------------------------------------
  const system = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    environment: process.env.NODE_ENV ?? "development",
    nextjsVersion: getNextjsVersion(),
    uptimeSeconds: Math.round(process.uptime()),
    currentTime: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return NextResponse.json({
    ai,
    storage,
    sync,
    database,
    system,
  });
}

/** Read the Next.js version from the installed package.json via fs (avoiding
 *  require.resolve, which the Next.js bundler mishandles for subpaths). */
function getNextjsVersion(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "next", "package.json"),
    path.join(process.cwd(), "..", "node_modules", "next", "package.json"),
  ];
  for (const p of candidates) {
    try {
      const content = fsReadFileSync(p, "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.version) return pkg.version;
    } catch {
      // try next candidate
    }
  }
  return "unknown";
}
