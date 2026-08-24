"use client";

// ============================================================================
// useDatabaseReady — initializes the Dexie DB and reports readiness
// ============================================================================

import { useEffect, useState } from "react";
import { initDatabase } from "@/lib/local-db";

type DbState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: string };

export function useDatabaseReady(): DbState {
  const [state, setState] = useState<DbState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(() => {
        if (!cancelled) setState({ status: "ready" });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err.message : "Database initialization failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
