"use client";

// ============================================================================
// OfflineIndicator — shows online/offline status badge
// ============================================================================

import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  className?: string;
  compact?: boolean;
}

export function OfflineIndicator({
  className,
  compact = false,
}: OfflineIndicatorProps) {
  const online = useOnlineStatus();

  if (online) {
    if (compact) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400",
            className
          )}
          title="Online"
        >
          <Wifi className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Online</span>
        </span>
      );
    }
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
          className
        )}
      >
        <Wifi className="h-3.5 w-3.5" />
        <span>Online</span>
      </div>
    );
  }

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400",
          className
        )}
        title="Offline — reading from local cache"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Offline</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline — data from local cache</span>
    </div>
  );
}
