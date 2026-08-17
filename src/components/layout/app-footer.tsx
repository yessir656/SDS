"use client";

// ============================================================================
// AppFooter — sticky footer with DOST-MIRDC org info
// ============================================================================

import Image from "next/image";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image
            src="/dost-mirdc-logo.png"
            alt="DOST-MIRDC"
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 object-contain"
          />
          <span>
            <span className="font-semibold text-foreground">SDS-CHEM</span>
            {" — "}
            Safety Data Sheet Centralized System
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Department of Science and Technology · Metals Industry Research &amp; Development Center
        </div>
      </div>
    </footer>
  );
}
