"use client";

// ============================================================================
// SDS-CHEM — Main Page (single-route SPA)
// Catalog → Detail → Emergency views all render here via Zustand state.
// ============================================================================

import { FlaskConical, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-teal-600/20" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg">
            <FlaskConical className="h-7 w-7" />
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
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
