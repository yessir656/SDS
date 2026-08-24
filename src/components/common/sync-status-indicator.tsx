"use client";

// ============================================================================
// SyncStatusIndicator — shows the current synchronization status in the header.
// States: synced (green) | syncing (blue, animated) | offline (amber) |
//         error (red, with retry button) | local-changes (slate)
// ============================================================================

import { RefreshCw, Check, CloudOff, AlertCircle, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { retrySync } from "@/hooks/use-sync";
import { cn } from "@/lib/utils";

export function SyncStatusIndicator() {
  const syncStatus = useAppStore((s) => s.syncStatus);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const syncError = useAppStore((s) => s.syncError);

  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const config = {
    synced: {
      icon: Check,
      label: lastSyncLabel ? `Synced ${lastSyncLabel}` : "Synced",
      className: "text-emerald-600 dark:text-emerald-400",
      pulse: false,
    },
    syncing: {
      icon: Loader2,
      label: "Syncing…",
      className: "text-blue-600 dark:text-blue-400",
      pulse: false,
    },
    offline: {
      icon: CloudOff,
      label: "Offline",
      className: "text-amber-600 dark:text-amber-400",
      pulse: false,
    },
    error: {
      icon: AlertCircle,
      label: "Sync failed",
      className: "text-red-600 dark:text-red-400",
      pulse: false,
    },
    "local-changes": {
      icon: RefreshCw,
      label: "Local changes",
      className: "text-slate-600 dark:text-slate-400",
      pulse: false,
    },
  } as const;

  const current = config[syncStatus] ?? config.offline;
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          current.className
        )}
        title={syncError ?? current.label}
      >
        <Icon className={cn("h-3.5 w-3.5", syncStatus === "syncing" && "animate-spin")} />
        <span className="hidden sm:inline">{current.label}</span>
      </span>

      {syncStatus === "error" && (
        <button
          onClick={() => retrySync()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          aria-label="Retry sync"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}
