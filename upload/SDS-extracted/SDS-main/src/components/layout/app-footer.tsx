"use client";

// ============================================================================
// AppFooter — sticky footer with org info
// ============================================================================

import { FlaskConical } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FlaskConical className="h-4 w-4 text-teal-600" />
          <span>
            <span className="font-semibold text-foreground">SDS-CHEM</span>
            {" — "}
            Safety Data Sheet Centralized System
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          MIRDC · Metal Industries Research &amp; Development Center, Philippines
        </div>
      </div>
    </footer>
  );
}
