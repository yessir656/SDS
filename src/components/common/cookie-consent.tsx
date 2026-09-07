"use client";

// ============================================================================
// CookieConsent — flat, persistent banner for SDS-CHEM.
//
// SDS-CHEM sets only ESSENTIAL cookies: the NextAuth session cookie used for
// admin login (httpOnly, SameSite=Lax, Secure in production) and a CSRF token
// cookie that NextAuth issues while the sign-in flow runs. There is no
// analytics, no marketing and no third-party tracking, so there are no
// non-essential cookies to opt out of — the banner's job is to INFORM and to
// record that an informed user accepted being told.
//
// Decision is stored in localStorage under `sds-chem-cookie-consent` so it
// persists across reloads/offline sessions; a mirroring `sds_cookies_accepted`
// cookie (365d) lets server-rendered pages read the same answer.
// ============================================================================

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sds-chem-cookie-consent";
const COOKIE_NAME = "sds_cookies_accepted";

// Suppress the banner on mount-only so there's no flash of an empty gap on the
// public catalog for first-time visitors (SSR renders nothing).
export function CookieConsent() {
  // Lazy initializer keeps the initial client render SSR-safe: during SSR we
  // render nothing, and on the first client paint we read the persisted choice.
  // The banner shows only when no prior decision ("accepted"/"seen") exists.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.location.pathname.startsWith("/admin/login")) return false;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v !== "accepted" && v !== "seen";
  });

  const accept = () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    // Mirror into a 365-day cookie so server-rendered responses can read it.
    document.cookie = `${COOKIE_NAME}=1; SameSite=Lax; path=/; max-age=${
      365 * 24 * 60 * 60
    }`;
    setVisible(false);
  };

  const dismiss = () => {
    // Dismiss (X) records "seen" so the banner doesn't re-appear every load,
    // but does NOT claim consent — the cookie-policy page remains reachable.
    window.localStorage.setItem(STORAGE_KEY, "seen");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:bottom-4 sm:pb-4">
        <div
          className="
            pointer-events-auto mx-auto flex max-w-3xl items-start gap-3
            rounded-xl border border-border bg-card px-4 py-3
            sm:items-center sm:rounded-2xl sm:px-5 sm:py-4
          "
        >
        {/* Flat accent stripe (border, not shadow, per the design system). */}
        <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl bg-mirdc-cyan" />
        <div className="ml-2 flex-1">
          <p className="font-medium text-foreground">
            SDS-CHEM uses only essential cookies — the session cookie that keeps
            your admin login alive and a CSRF token for the sign-in flow. We do
            not use analytics or third-party tracking.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your catalog is also cached locally in this browser (IndexedDB +
            the service-worker cache) so the app works offline.
            <a
              href="/cookie-policy"
              className="ml-1 font-medium text-mirdc-cyan underline decoration-mirdc-cyan/30 underline-offset-2 hover:text-mirdc-cyan/80"
            >
              Learn more
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs opacity-60 hover:opacity-100"
            onClick={dismiss}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 border-0 bg-navy-800 text-[11px] font-semibold text-white hover:bg-navy-900"
            onClick={accept}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
