"use client";

// ============================================================================
// useSync — React hook that drives the automatic synchronization lifecycle.
// ============================================================================
//
// Mount this hook once at the top level of the public PWA (in page.tsx).
// It:
//   1. Triggers a sync on app startup (if online).
//   2. Watches useOnlineStatus and triggers sync on offline → online transition.
//   3. Starts periodic background sync (every 5 minutes while online).
//   4. Updates the Zustand sync status so the UI indicator stays in sync.
// ============================================================================

import { useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAppStore } from "@/store/app-store";
import { syncNow, startPeriodicSync, stopPeriodicSync } from "@/lib/sync-engine";
import { db } from "@/lib/local-db";

export function useSync(): void {
  const online = useOnlineStatus();
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);
  const setLastSyncAt = useAppStore((s) => s.setLastSyncAt);
  const hasInitialized = useRef(false);

  // --- On mount: set initial status and trigger first sync if online ---
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Set the initial sync status based on online state.
    if (navigator.onLine) {
      setSyncStatus("syncing");
      // Trigger the first sync.
      syncNow(true).then(async (result) => {
        if (result.ok) {
          setSyncStatus("synced");
          setLastSyncAt(Date.now());
        } else {
          setSyncStatus("error", result.error);
        }
        // Read the last sync timestamp from the DB for the indicator.
        const meta = await db.syncMeta.get("default");
        if (meta?.lastSyncAt) setLastSyncAt(meta.lastSyncAt);
      });
    } else {
      setSyncStatus("offline");
    }

    // Start periodic sync.
    startPeriodicSync();

    return () => {
      stopPeriodicSync();
    };
  }, [setSyncStatus, setLastSyncAt]);

  // --- On offline → online transition: trigger sync ---
  useEffect(() => {
    // Skip the initial mount (handled above).
    if (!hasInitialized.current) return;

    if (online) {
      setSyncStatus("syncing");
      syncNow(true).then(async (result) => {
        if (result.ok) {
          setSyncStatus("synced");
          setLastSyncAt(Date.now());
        } else {
          setSyncStatus("error", result.error);
        }
        const meta = await db.syncMeta.get("default");
        if (meta?.lastSyncAt) setLastSyncAt(meta.lastSyncAt);
      });
    } else {
      setSyncStatus("offline");
    }
  }, [online, setSyncStatus, setLastSyncAt]);
}

/**
 * Manual sync retry — called by the "retry" button in the sync status indicator.
 */
export async function retrySync(): Promise<void> {
  const store = useAppStore.getState();
  store.setSyncStatus("syncing");
  const result = await syncNow(true);
  if (result.ok) {
    store.setSyncStatus("synced");
    store.setLastSyncAt(Date.now());
  } else {
    store.setSyncStatus("error", result.error);
  }
}
