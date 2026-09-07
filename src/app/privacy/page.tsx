// ============================================================================
// /privacy — Privacy Policy
// Template reflecting SDS-CHEM's VERIFIED data practices. Not legal advice —
// review with DOST-MIRDC counsel before publishing.
// ============================================================================

import { LegalPage, FooterLink } from "@/components/common/legal-page";

export const metadata = {
  title: "Privacy Policy | SDS-CHEM — DOST-MIRDC",
  description:
    "SDS-CHEM privacy policy: what data the offline-first chemical SDS system collects, where it is stored, and your rights.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        SDS-CHEM is a Safety Data Sheet management application built for the
        Department of Science and Technology — Metropolitan Industry Research and
        Development Center (DOST-MIRDC). This policy describes what information
        the application handles, how it is used, and the choices you have.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Who we are</h2>
        <p>
          SDS-CHEM is operated by DOST-MIRDC. It is an <strong>offline-first
          Progressive Web App</strong> that runs on your local machine or
          internal network. It is not a public website and is not intended for
          general internet users.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Information you provide</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Chemical records and SDS documents</strong> that an
            administrator enters or uploads (names, CAS numbers, formulas,
            hazard classifications, pictograms, storage locations, and the SDS
            PDF files themselves).
          </li>
          <li>
            <strong>Admin account information</strong>: an email address and a
            password hash for administrators. Passwords are hashed with bcrypt
            (12 rounds) and never stored in plaintext.
          </li>
          <li>
            <strong>Audit entries</strong> recording who created, edited, or
            deleted each record and when.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Where your data is stored</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong>Server-side (admin area)</strong>: a local SQLite database
            (<code>custom.db</code>) on the machine that hosts SDS-CHEM. SDS PDF
            files are stored on disk in <code>storage/sds</code>.
          </li>
          <li>
            <strong>Browser-side (public catalog + offline use)</strong>: the
            catalog is cached in the browser using IndexedDB, <code>localStorage</code>{" "}
            (for your theme/last-viewed preferences), and the service-worker
            <strong> Cache API</strong>. This cache is what lets the app work
            <strong> with no WiFi</strong>.
          </li>
        </ol>
        <p>
          Data does <strong>not</strong> leave your local machine or network for
          any third party. There is no cloud sync, no analytics service, and no
          external sharing beyond the people you choose to grant admin access.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">How we use your information</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To present the chemical catalog and SDS documents.</li>
          <li>To authenticate administrators and authorize admin-only actions.</li>
          <li>To keep a tamper-evident audit trail of changes.</li>
          <li>
            To serve the app shell and SDS files from the cache while offline.
          </li>
          <li>To auto-fill fields and attach the picked PDF (see{" "}
            <FooterLink href="/terms">Terms</FooterLink>).</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cookies</h2>
        <p>
          SDS-CHEM uses only <strong>strictly necessary</strong> cookies:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The NextAuth session token cookie that keeps you signed in while you
            use the admin area. It is <code>httpOnly</code>,
            <code> SameSite=Lax</code>, and <code>Secure</code> in production.
          </li>
          <li>
            A CSRF token cookie that NextAuth issues only while you are signing
            in.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> use analytics, advertising, or any
          third-party tracking cookies. See the{" "}
          <FooterLink href="/cookie-policy">Cookie Policy</FooterLink>{" "}
          for details.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your rights</h2>
        <p>You may, at any time:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Browse the public catalog.</li>
          <li>
            Request a copy of or correction to your records via an
            administrator.
          </li>
          <li>
            Have records deleted. Deletions are <strong>soft-deletes</strong>
            (a tombstone is kept so offline devices stay in sync); hard
            deletion of SDS files is performed by the admin through the
            application UI.
          </li>
          <li>
            Stop further use of the app at any time by closing it.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Data retention</h2>
        <p>
          Records are retained for as long as the local database is kept.
          Soft-deleted records remain as tombstones in the database so that
          offline devices can reconcile their local caches, and may be purged by
          an administrator through the application UI.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Children</h2>
        <p>
          SDS-CHEM is intended for trained laboratory and safety personnel. It
          is not intended for children, and no information is knowingly
          collected from children.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Changes to this policy</h2>
        <p>
          If this policy changes, the updated version is published here with a
          revised "Last updated" date.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Questions about this policy should be directed to DOST-MIRDC through
          your local system administrator.
        </p>
      </section>
    </LegalPage>
  );
}
