"use client";

// ============================================================================
// SDS-CHEM — Main Page (single-route SPA)
// Fresh "Laboratory Command Center" shell: hero command bar + content + footer.
// ============================================================================

import { useEffect } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { ChemicalCatalog } from "@/components/catalog/chemical-catalog";
import { ChemicalDetail } from "@/components/detail/chemical-detail";
import { EmergencyView } from "@/components/emergency/emergency-view";
import { EmergencyFab } from "@/components/emergency/emergency-fab";
import { KeyboardShortcutsHelp } from "@/components/common/keyboard-shortcuts-help";
import { useDatabaseReady } from "@/hooks/use-database-ready";
import { useSync } from "@/hooks/use-sync";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAppStore } from "@/store/app-store";

export default function Home() {
  const dbState = useDatabaseReady();
  const currentView = useAppStore((s) => s.currentView);

  useSync();
  useKeyboardShortcuts();

  if (dbState.status === "loading") {
    return (
      <div className="bg-navy-hero relative flex min-h-screen flex-col items-center justify-center gap-7 overflow-hidden">
        <div className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-mirdc-cyan/10 blur-2xl" />
        <div className="absolute -right-16 bottom-1/4 h-72 w-72 rounded-3xl bg-white/5 blur-2xl" />
        <div className="absolute right-1/4 top-12 h-14 w-14 rotate-45 rounded-md bg-mirdc-cyan/20" />
        <div className="relative flex flex-col items-center gap-5">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-2xl">
            <Image
              src="/dost-mirdc-logo.png"
              alt="DOST-MIRDC"
              width={72}
              height={72}
              className="h-[72px] w-[72px] object-contain"
              priority
            />
            <span className="absolute -inset-1 -z-10 rounded-2xl bg-mirdc-cyan/30 blur-md" />
          </div>
          <div className="relative flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">SDS-CHEM</h1>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-navy-200">
              DOST-MIRDC Safety Data Sheet System
            </p>
          </div>
          <div className="relative flex items-center gap-2.5 text-sm font-medium text-navy-100">
            <Loader2 className="h-4 w-4 animate-spin text-mirdc-cyan" />
            <span>Loading chemical database…</span>
          </div>
        </div>
      </div>
    );
  }

  if (dbState.status === "error") {
    return (
      <div className="bg-grid flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/50">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold">Database Error</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{dbState.error}</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reload
        </Button>
      </div>
    );
  }

  if (currentView === "emergency") {
    return <EmergencyView />;
  }

  return (
    <div className="bg-grid flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ViewRouter currentView={currentView} />
      </main>
      <AppFooter />
      <EmergencyFab />
      <KeyboardShortcutsHelp />
    </div>
  );
}

/**
 * View router + scroll-to-top.
 */
function ViewRouter({ currentView }: { currentView: "catalog" | "detail" }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentView]);
  return currentView === "detail" ? <ChemicalDetail /> : <ChemicalCatalog />;
}