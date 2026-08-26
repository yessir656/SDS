// ============================================================================
// Sync Engine — the core offline-first synchronization mechanism.
// ============================================================================
//
// Architecture:
//   Backend (Prisma)  →  GET /api/sync?since=<ts>  →  Client (Dexie)
//
// The client calls /api/sync with its last-known server timestamp. The server
// returns only chemicals and SDS documents changed since then. The client
// applies those changes to IndexedDB, stores the new server timestamp, and
// downloads any SDS PDFs whose version has changed.
//
// Sync triggers:
//   1. App startup (if online)
//   2. Offline → online transition (via useSync hook watching useOnlineStatus)
//   3. Periodically while online (every 5 minutes, configurable)
//
// Conflict resolution:
//   - Chemical / SDS data: SERVER WINS. The admin is the source of truth.
//     Client-side changes to these records are not supported.
//   - User preferences / favorites: LOCAL ONLY. These are per-device and
//     never synced to the server.
//
// The sync engine is designed to be idempotent and safe to call concurrently
// — a mutex prevents overlapping sync runs.
// ============================================================================

import { db } from "@/lib/local-db";
import type { ChemicalRecord, SdsDocumentRecord } from "@/types";

const SYNC_ENDPOINT = "/api/sync";
// Append ?v=<version> as a cache-buster. The server ignores this query param,
// but it forces the browser HTTP cache to treat each version as a distinct
// resource — critical so a newly-uploaded PDF isn't shadowed by a cached
// placeholder at the same URL.
const SDS_DOWNLOAD_ENDPOINT = (id: string, version?: number) =>
  `/api/sds/${id}/download${version != null ? `?v=${version}` : ""}`;
const PERIODIC_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Mutex — prevent overlapping sync runs
// ---------------------------------------------------------------------------

let syncInProgress = false;
let lastSyncAttempt = 0;
const MIN_SYNC_INTERVAL = 10 * 1000; // minimum 10s between sync attempts

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

// ---------------------------------------------------------------------------
// Core sync function
// ---------------------------------------------------------------------------

export interface SyncResult {
  ok: boolean;
  error?: string;
  chemicalsUpdated: number;
  sdsUpdated: number;
  chemicalsDeleted: number;
  sdsBlobsDownloaded: number;
  serverTime: number;
}

/**
 * Run a full sync cycle. Safe to call repeatedly — the mutex prevents overlap
 * and the minimum-interval guard prevents excessive requests.
 */
export async function syncNow(force = false): Promise<SyncResult> {
  // Mutex: don't start a new sync if one is already running.
  if (syncInProgress) {
    return {
      ok: false,
      error: "Sync already in progress",
      chemicalsUpdated: 0,
      sdsUpdated: 0,
      chemicalsDeleted: 0,
      sdsBlobsDownloaded: 0,
      serverTime: 0,
    };
  }

  // Rate limit: don't sync more often than MIN_SYNC_INTERVAL (unless forced).
  const now = Date.now();
  if (!force && now - lastSyncAttempt < MIN_SYNC_INTERVAL) {
    return {
      ok: false,
      error: "Sync rate limited",
      chemicalsUpdated: 0,
      sdsUpdated: 0,
      chemicalsDeleted: 0,
      sdsBlobsDownloaded: 0,
      serverTime: 0,
    };
  }

  syncInProgress = true;
  lastSyncAttempt = now;

  try {
    // Read the last sync timestamp from local metadata.
    const meta = await db.syncMeta.get("default");
    const since = meta?.lastSyncTimestamp ?? 0;

    // Fetch changes from the server.
    const url = `${SYNC_ENDPOINT}?since=${since}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Sync HTTP error: ${res.status}`);
    }

    const data = await res.json();

    let chemicalsUpdated = 0;
    let sdsUpdated = 0;
    let chemicalsDeleted = 0;

    // Apply changes in a single transaction for atomicity.
    await db.transaction(
      "rw",
      db.chemicals,
      db.sdsDocuments,
      db.sdsBlobs,
      db.syncMeta,
      async () => {
        // 1. Apply chemical updates/additions.
        for (const chem of data.chemicals as ChemicalRecord[]) {
          await db.chemicals.put(chem);
          chemicalsUpdated++;
        }

        // 2. Apply SDS metadata updates.
        for (const sds of data.sdsDocuments as SdsDocumentRecord[]) {
          await db.sdsDocuments.put(sds);
          sdsUpdated++;
        }

        // 3. Apply chemical deletes.
        for (const id of data.deletedChemicalIds as string[]) {
          await db.chemicals.delete(id);
          // Also clean up any local SDS data for the deleted chemical.
          const sdsRecords = await db.sdsDocuments
            .where("chemicalId")
            .equals(id)
            .toArray();
          for (const sds of sdsRecords) {
            await db.sdsDocuments.delete(sds.id);
            await db.sdsBlobs.delete(sds.id);
          }
          chemicalsDeleted++;
        }

        // 4. Apply SDS deletes (rare — admin revert is handled as update).
        for (const id of data.deletedSdsIds as string[]) {
          await db.sdsDocuments.delete(id);
          await db.sdsBlobs.delete(id);
        }

        // 4b. Reconcile HARD deletes: the delta feed can only report
        // soft-deleted tombstones, so rows removed out-of-band (directly in
        // the database) would linger in the local cache forever. Every sync
        // carries the server's full active-ID list — drop anything local
        // that the server no longer has, together with its cached SDS
        // metadata and PDF blob.
        if (Array.isArray(data.activeChemicalIds)) {
          const activeIds = new Set<string>(data.activeChemicalIds);
          const localIds = (await db.chemicals.toCollection().primaryKeys()).map(
            String
          );
          for (const id of localIds) {
            if (activeIds.has(id)) continue;
            const sdsRecords = await db.sdsDocuments
              .where("chemicalId")
              .equals(id)
              .toArray();
            for (const sds of sdsRecords) {
              await db.sdsDocuments.delete(sds.id);
              await db.sdsBlobs.delete(sds.id);
            }
            await db.chemicals.delete(id);
            chemicalsDeleted++;
          }
        }

        // 5. Update sync metadata with the server's current time.
        await db.syncMeta.put({
          id: "default",
          lastSyncTimestamp: data.serverTime,
          lastSyncAt: Date.now(),
        });
      }
    );

    // 6. Download updated SDS PDF blobs (outside the metadata transaction).
    const sdsBlobsDownloaded = await syncSdsBlobs();

    return {
      ok: true,
      chemicalsUpdated,
      sdsUpdated,
      chemicalsDeleted,
      sdsBlobsDownloaded,
      serverTime: data.serverTime,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown sync error",
      chemicalsUpdated: 0,
      sdsUpdated: 0,
      chemicalsDeleted: 0,
      sdsBlobsDownloaded: 0,
      serverTime: 0,
    };
  } finally {
    syncInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// SDS blob synchronization — download PDFs whose version changed
// ---------------------------------------------------------------------------

async function syncSdsBlobs(): Promise<number> {
  let downloaded = 0;
  const allSds = await db.sdsDocuments.toArray();

  for (const sds of allSds) {
    const cached = await db.sdsBlobs.get(sds.id);

    // Skip if the cached blob version matches the current SDS version.
    if (cached && cached.version === sds.version) continue;

    try {
      const res = await fetch(SDS_DOWNLOAD_ENDPOINT(sds.id, sds.version));
      if (!res.ok) continue;

      const blob = await res.blob();
      await db.sdsBlobs.put({
        sdsId: sds.id,
        blob,
        version: sds.version,
        cachedAt: Date.now(),
      });
      downloaded++;
    } catch {
      // Network error or server unavailable — skip this SDS.
      // It will be retried on the next sync.
    }
  }

  return downloaded;
}

// ---------------------------------------------------------------------------
// Periodic sync scheduler
// ---------------------------------------------------------------------------

let periodicTimer: ReturnType<typeof setInterval> | null = null;

/** Start periodic background sync (call once when the app mounts, if online). */
export function startPeriodicSync(): void {
  if (periodicTimer) return;
  periodicTimer = setInterval(() => {
    if (navigator.onLine && !syncInProgress) {
      syncNow().catch(() => {
        // Silently swallow — the UI status indicator will reflect the error.
      });
    }
  }, PERIODIC_SYNC_INTERVAL);
}

/** Stop periodic background sync. */
export function stopPeriodicSync(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

// ---------------------------------------------------------------------------
// SDS blob retrieval for the "View SDS" feature
// ---------------------------------------------------------------------------

/**
 * Get the SDS PDF blob for a chemical.
 *
 * SAFETY-CRITICAL: SDS PDFs must never show a stale placeholder after the
 * admin has uploaded the real document. The local IndexedDB cache can lag
 * behind the server (sync runs every 5 min, and the local SDS metadata may
 * still report v1 while the server already has v2). If we trusted the local
 * version check alone, we'd return the stale cached placeholder blob.
 *
 * Strategy:
 *   1. When ONLINE: always fetch fresh bytes from the server. The download
 *      route sets Cache-Control: no-store, so the browser HTTP cache won't
 *      shadow us. Update the IndexedDB cache with the result so offline
 *      viewings stay current.
 *   2. When OFFLINE (or fetch fails): fall back to the IndexedDB cache.
 */
export async function getSdsBlobForChemical(
  chemicalId: string
): Promise<Blob | null> {
  const sds = await db.sdsDocuments
    .where("chemicalId")
    .equals(chemicalId)
    .first();
  if (!sds) return null;

  // When online, ALWAYS fetch fresh from the server. This guarantees the
  // user sees the latest uploaded PDF, not a stale placeholder that was
  // cached before the admin uploaded the real document.
  if (navigator.onLine) {
    try {
      const res = await fetch(
        SDS_DOWNLOAD_ENDPOINT(sds.id, sds.version),
        { cache: "no-store" }
      );
      if (res.ok) {
        const blob = await res.blob();
        // Refresh the local cache so subsequent offline viewings are current.
        await db.sdsBlobs.put({
          sdsId: sds.id,
          blob,
          version: sds.version,
          cachedAt: Date.now(),
        });
        return blob;
      }
    } catch {
      // Network error — fall through to the offline cache below.
    }
  }

  // Offline (or fetch failed) — return the cached blob if available.
  const cached = await db.sdsBlobs.get(sds.id);
  return cached?.blob ?? null;
}
