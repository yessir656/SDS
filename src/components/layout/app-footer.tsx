"use client";

// ============================================================================
// AppFooter — sticky footer with DOST-MIRDC org info + legal links
// Fresh: navy band that anchors the page bottom, with a subtle cyan hairline.
// ============================================================================

import Image from "next/image";
import Link from "next/link";

function FooterNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-navy-200 underline decoration-mirdc-cyan/30 underline-offset-2 hover:text-white hover:decoration-mirdc-cyan"
    >
      {children}
    </Link>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t-2 border-mirdc-cyan/20 bg-navy-hero">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-7 text-center sm:px-6 sm:text-left lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/dost-mirdc-logo.png"
            alt="DOST-MIRDC"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded bg-white/90 p-0.5 object-contain"
          />
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-sm font-semibold text-white">
              SDS-CHEM{" "}
              <span className="font-normal text-navy-200">
                — Safety Data Sheet Centralized System
              </span>
            </span>
            <span className="text-[11px] text-navy-200">
              Department of Science and Technology · Metals Industry Research
              &amp; Development Center
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-navy-300 sm:order-none sm:flex-row">
          <p className="order-first sm:order-none">Offline-first · Works without internet</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <FooterNavLink href="/privacy">Privacy</FooterNavLink>
            <span className="hidden sm:inline text-navy-600 dark:text-navy-700">·</span>
            <FooterNavLink href="/terms">Terms</FooterNavLink>
            <span className="hidden sm:inline text-navy-600 dark:text-navy-700">·</span>
            <FooterNavLink href="/cookie-policy">Cookie Policy</FooterNavLink>
          </div>
        </div>
      </div>
    </footer>
  );
}