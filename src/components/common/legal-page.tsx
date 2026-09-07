// ============================================================================
// LegalPage — shared shell for the flat-design policy pages.
//
// IMPORTANT: the body copy in the policy pages is a *template* that reflects the
// app's VERIFIED data practices only. It is NOT legal advice and must be
// reviewed by DOST-MIRDC's legal counsel before publishing. Each page surfaces a
// prominent banner to that effect. Flat design system: gray canvas, white
// color-block card, borders for depth, Outfit font (font-sans is applied body-
// wide in layout.tsx).
// ============================================================================

import Link from "next/link";
import { AppFooter } from "@/components/layout/app-footer";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
        <article className="space-y-6">
          <header className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: September 2026
            </p>
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              This page is a template generated from SDS-CHEM's verified data
              practices and is <strong>not legal advice</strong>. DOST-MIRDC
              legal counsel should review and adopt it before it goes live.
            </div>
          </header>

          <div className="prose prose-sm max-w-none text-foreground">
            {children}
          </div>
        </article>
      </main>
      <AppFooter />
    </div>
  );
}

// Reuse the footer's nav helper for "back to site" links inside policy bodies.
export function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-mirdc-cyan underline decoration-mirdc-cyan/30 underline-offset-2 hover:text-mirdc-cyan/80"
    >
      {children}
    </Link>
  );
}
