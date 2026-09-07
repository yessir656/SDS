// ============================================================================
// /terms — Terms & Conditions
// Template reflecting SDS-CHEM's VERIFIED behavior. Not legal advice — review
// with DOST-MIRDC counsel before publishing.
// ============================================================================

import { LegalPage, FooterLink } from "@/components/common/legal-page";

export const metadata = {
  title: "Terms & Conditions | SDS-CHEM — DOST-MIRDC",
  description:
    "SDS-CHEM Terms & Conditions for use of the offline-first chemical SDS system.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These terms govern your use of SDS-CHEM, a Safety Data Sheet management
        application operated by the Department of Science and Technology —
        Metropolitan Industry Research and Development Center (DOST-MIRDC). By
        accessing or using the application you agree to these terms.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">License</h2>
        <p>
          SDS-CHEM is provided to authorized DOST-MIRDC personnel and
          affiliated users for lawful laboratory safety and SDS-management
          purposes. You may not redistribute, sell, or resell the application or
          its data except as permitted by DOST-MIRDC policy.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Access to the admin area requires credentials issued by DOST-MIRDC.
            You are responsible for keeping your password confidential.
          </li>
          <li>
            You must not share your credentials except with your designated
            system administrator.
          </li>
          <li>
            Dormant or compromised accounts may be disabled by an
            administrator without notice.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your responsibilities</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Enter chemical data accurately and review auto-filled fields before
            saving. SDS-CHEM can automatically extract fields and attach a picked
            PDF (see the <FooterLink href="/privacy">Privacy Policy</FooterLink>):
            extraction is a convenience and may contain errors or omissions
            that you must verify.
          </li>
          <li>Do not upload files you do not have authority to use.</li>
          <li>Back up your data. The application stores data locally; regular
            backups of the <code>storage/sds</code> folder and the SQLite
            database are your responsibility.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Prohibited use</h2>
        <p>You must not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Use the app for any unlawful purpose.</li>
          <li>Attempt to bypass authentication or authorization controls.</li>
          <li>Upload malware, malicious code, or non-SDS files.</li>
          <li>Overload or abuse the service (e.g. denial of service).</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Accuracy of automated extraction</h2>
        <p>
          SDS-CHEM uses a tiered, free-first pipeline to pre-fill fields from a
          PDF (embedded text, then offline OCR, then an AI fallback). These
          methods can miss, misread, or omit information. <strong>You must
          review and confirm every field before relying on it.</strong> SDS-CHEM
          is not liable for decisions based on unverified auto-filled data.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Intellectual property</h2>
        <p>
          SDS-CHEM and its source code are the property of DOST-MIRDC. SDS
          documents and chemical records are submitted for and belong to the
          organization that supplied them. Third-party components (Next.js,
          React, Prisma, tisseo OCR stack, and others) remain the property of
          their respective owners and are used under their own licenses.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Third-party software</h2>
        <p>
          SDS-CHEM incorporates open-source libraries. They are provided subject
          to their respective licenses; this section does not limit those rights.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">No warranty</h2>
        <p>
          To the fullest extent permitted by law, SDS-CHEM is provided "as is"
          and "as available", without warranties of any kind, express or implied,
          including without limitation any implied warranties of merchantability,
          fitness for a particular purpose, or non-infringement. DOST-MIRDC does
          not warrant that the application will be error-free, uninterrupted, or
          unavailable-proof.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, under no circumstances shall
          DOST-MIRDC or its personnel be liable for any indirect, incidental,
          special, consequential, or punitive damages, or any loss of data,
          profits, or business, arising out of or in connection with the use of
          SDS-CHEM.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Termination</h2>
        <p>
          DOST-MIRDC may suspend or terminate access to the admin area at any
          time, with or without cause. The "undo" guarantee on deletions applies
          only within the application's soft-delete window and storage root.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Governing law</h2>
        <p>
          These terms are governed by the laws of the Philippines, including the
          Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Changes to these terms</h2>
        <p>
          Updated terms are posted here with a revised "Last updated" date. Your
          continued use after changes take effect constitutes acceptance.
        </p>
      </section>

      <p>
        For questions, please contact DOST-MIRDC through your local system
        administrator.
      </p>
    </LegalPage>
  );
}
