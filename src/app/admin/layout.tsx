import type { Metadata } from "next";
import { AdminSessionProvider } from "@/components/admin/session-provider";
import { PasswordGuard } from "@/components/admin/password-guard";

export const metadata: Metadata = {
  title: "SDS-CHEM Admin",
  description: "Admin dashboard for SDS chemical management",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider>
      <PasswordGuard>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</div>
      </PasswordGuard>
    </AdminSessionProvider>
  );
}
