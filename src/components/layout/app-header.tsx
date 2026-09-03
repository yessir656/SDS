"use client";

// ============================================================================
// AppHeader — "Command Bar"
// Full-bleed navy hero with MIRDC logo, wordmark, status pills, and theme toggle.
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-hero">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo + wordmark (click returns to catalog) */}
        <button
          onClick={goToCatalog}
          className="flex items-center gap-3 rounded-xl px-1.5 py-1 outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-mirdc-cyan/60"
          aria-label="SDS-CHEM home"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white/95 shadow-lg">
            <Image
              src="/dost-mirdc-logo.png"
              alt="DOST-MIRDC logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </span>
          <span className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-[15px] font-bold tracking-tight text-white">
              SDS-CHEM
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-navy-200">
              DOST-MIRDC
            </span>
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white sm:hidden">
            SDS-CHEM
          </span>
        </button>

        {/* Status cluster — pushed right. Frosted chips separate them visually. */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-2.5 backdrop-blur-sm">
            <SyncStatusIndicator />
          </span>
          <span className="flex h-9 items-center rounded-full bg-white/10 px-2.5 backdrop-blur-sm">
            <OfflineIndicator compact />
          </span>

          {currentView === "detail" && (
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30 md:inline-flex">
              <ShieldAlert className="h-3.5 w-3.5" />
              Emergency ready
            </span>
          )}

          {/* Theme toggle sits on a frosted chip so it reads on navy */}
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <ThemeToggle />
          </span>
        </div>
      </div>
    </header>
  );
}