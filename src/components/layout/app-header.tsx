"use client";

// ============================================================================
// AppHeader — top navigation bar with DOST-MIRDC logo, title, status, theme toggle
// ============================================================================

import Image from "next/image";
import { ShieldAlert } from "lucide-react";
import { OfflineIndicator } from "@/components/common/offline-indicator";
import { SyncStatusIndicator } from "@/components/common/sync-status-indicator";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { useAppStore } from "@/store/app-store";

export function AppHeader() {
  const goToCatalog = useAppStore((s) => s.goCatalog);
  const currentView = useAppStore((s) => s.currentView);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Logo + title (click to return to catalog) */}
        <button
          onClick={goToCatalog}
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="SDS-CHEM home"
        >
          <Image
            src="/dost-mirdc-logo.png"
            alt="DOST-MIRDC logo"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md object-contain"
            priority
          />
          <span className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-base font-bold tracking-tight text-foreground">
              SDS-CHEM
            </span>
            <span className="text-[11px] text-muted-foreground">
              DOST-MIRDC Safety Data Sheet System
            </span>
          </span>
          <span className="text-base font-bold tracking-tight text-foreground sm:hidden">
            SDS-CHEM
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <SyncStatusIndicator />
          <OfflineIndicator compact />

          {currentView === "detail" && (
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300 md:inline-flex">
              <ShieldAlert className="h-3.5 w-3.5" />
              Emergency ready
            </span>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
