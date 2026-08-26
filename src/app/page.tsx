"use client";

// ============================================================================
// SDS-CHEM — Main Page (single-route SPA)
// Catalog → Detail → Emergency views all render here via Zustand state.
// ============================================================================

import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { ChemicalCatalog } from "@/components/catalog/chemical-catalog";
import { ChemicalDetail } from "@/components/detail/chemical-detail";
import { EmergencyView } from "@/components/emergency/emergency-view";
import { EmergencyFab } from "@/components/emergency/emergency-fab";
import { useDatabaseReady } from "@/hooks/use-database-ready";
import { useSync } from "@/hooks/use-sync";
import { useAppStore } from "@/store/app-store";

export default function Home() {
  const dbState = useDatabaseReady();
  const currentView = useAppStore((s) => s.currentView);

  // Mount the sync lifecycle (startup, online transition, periodic).
  useSync();

  // --- Loading state ---
  if (dbState.status === "loading") {
    return (
      // Flat poster moment: solid navy block + low-opacity geometric shapes.
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-navy-900">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mirdc-cyan/10" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rotate-12 rounded-3xl bg-white/5" />
        <div className="absolute right-16 top-14 h-16 w-16 rounded-full bg-white/5" />

        <div className="relative flex h-20 w-20 items-center justify-center rounded-lg bg-white">
          <Image
            src="/dost-mirdc-logo.png"
            alt="DOST-MIRDC"
            width={64}
            height={64}
            className="h-16 w-16 object-contain"
            priority
          />
        </div>
        <div className="relative flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-100">
          <Loader2 className="h-4 w-4 animate-spin text-mirdc-cyan" />
          <span>Loading chemical database…</span>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (dbState.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Database Error</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {dbState.error}
          </p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reload
        </Button>
      </div>
    );
  }

  // --- Emergency view (full-screen overlay, no header/footer) ---
  if (currentView === "emergency") {
    return <EmergencyView />;
  }

  // --- Normal app shell (header + content + footer + FAB) ---
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        {currentView === "detail" ? <ChemicalDetail /> : <ChemicalCatalog />}
      </main>

      <AppFooter />
      <EmergencyFab />
    </div>
  );
}
