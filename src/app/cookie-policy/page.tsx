// ============================================================================
// /cookie-policy — Cookie Policy
// Template reflecting SDS-CHEM's VERIFIED cookie + client-side storage. Not
// legal advice — review with DOST-MIRDC counsel before publishing.
// ============================================================================

import { LegalPage, FooterLink } from "@/components/common/legal-page";

export const metadata = {
  title: "Cookie Policy | SDS-CHEM — DOST-MIRDC",
  description:
    "SDS-CHEM Cookie Policy: the strictly-necessary cookies used for login and the local caches that enable offline use.",
};

const cookies = [
  {
    name: "next-auth.session-token",
    purpose: "Keeps you signed in to the admin area (NextAuth session).",
    essential: true,
    duration: "30 days (session maxAge).",
    third: false,
  },
  {
    name: "__Secure-next-auth.session-token (production)",
    purpose:
      "Production variant of the session cookie; the __Secure- prefix requires Secure + Path=/ and HTTPS.",
    essential: true,
    duration: "30 days.",
    third: false,
  },
  {
    name: "next-auth.csrf-token",
    purpose:
      "Anti-CSRF token issued by NextAuth solely during the sign-in flow.",
    essential: true,
    duration: "Transient (cleared after sign-in).",
    third: false,
  },
  {
    name: "sds_cookies_accepted",
    purpose:
      "Records that you were shown this cookie policy and accepted. Set by SDS-CHEM, not by third parties.",
    essential: false,
    duration: "365 days.",
    third: false,
  },
];

const clientStorage = [
  {
    name: "IndexedDB (Dexie)",
    purpose:
      "Offline cache of the chemical catalog and SDS documents so the app works with no network.",
    controller: "First party (SDS-CHEM).",
  },
  {
    name: "localStorage",
    purpose: "Your theme preference, recently-viewed chemicals, and consent state.",
    controller: "First party (SDS-CHEM).",
  },
  {
    name: "Service-worker Cache API",
    purpose: "Caches the app shell, static assets, and SDS PDFs for offline use.",
    controller: "First party (SDS-CHEM).",
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        SDS-CHEM is an offline-first Progressive Web App operated by DOST-MIRDC.
        This policy explains what cookies and similar local storage the
        application uses, and why.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What this app does NOT do</h2>
        <p>
          SDS-CHEM sets <strong>no analytics, advertising, or third-party
          tracking cookies</strong>. We do not use Google Analytics, Meta
          pixels, or any social/remarketing widgets. We do not sell or rent your
          data.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cookies we use</h2>
        <p>All cookies below are set by SDS-CHEM itself (first party):</p>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-medium">Name</th>
                <th className="text-left py-2 pr-3 font-medium">Purpose</th>
                <th className="text-left py-2 pr-3 font-medium">Essential</th>
                <th className="text-left py-2 pr-3 font-medium">Duration</th>
                <th className="text-left py-2 pr-3 font-medium">Third-party</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((c) => (
                <tr key={c.name} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {c.name}
                  </td>
                  <td className="py-2 pr-3">{c.purpose}</td>
                  <td className="py-2 pr-3">
                    {c.essential ? "Yes" : "No"}
                  </td>
                  <td className="py-2 pr-3">{c.duration}</td>
                  <td className="py-2 pr-3">{c.third ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          The session and CSRF tokens are <strong>strictly necessary</strong>
          for the admin login to work and cannot be opted out of while using the
          admin area. The <code>sds_cookies_accepted</code> marker is optional
          and may be cleared at any time through your browser's storage settings
          (see below).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Other local storage (not cookies)</h2>
        <p>
          In addition to the cookies above, SDS-CHEM stores data locally in your
          browser so it can work <strong>offline</strong>. These stores are
          controlled only by SDS-CHEM and are never sent to a third party:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-medium">Store</th>
                <th className="text-left py-2 pr-3 font-medium">Purpose</th>
                <th className="text-left py-2 pr-3 font-medium">Controller</th>
              </tr>
            </thead>
            <tbody>
              {clientStorage.map((s) => (
                <tr key={s.name} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono text-xs">{s.name}</td>
                  <td className="py-2 pr-3">{s.purpose}</td>
                  <td className="py-2 pr-3">{s.controller}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Managing your choices</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The cookie-consent banner is shown the first time you visit. You can
            dismiss it or accept it. Dismissing does not record "consent" — it
            records that you were informed.
          </li>
          <li>
            Because the session/CSRF cookies are strictly necessary for the
            admin area, they are (and must remain) active while you are signed
            in. You can delete or block them via your browser's cookie settings,
            but doing so will sign you out.
          </li>
          <li>
            To clear locally cached data, use your browser's "Clear browsing
            data" and remove site data for this host. Note this will also delete
            your cached offline catalog, which will re-sync the next time the
            app goes online (see the{" "}
            <FooterLink href="/privacy">Privacy Policy</FooterLink>).
          </li>
        </ul>
      </section>

      <p>
        This policy is reviewed periodically. Questions? Contact DOST-MIRDC
        through your system administrator.
      </p>
    </LegalPage>
  );
}
