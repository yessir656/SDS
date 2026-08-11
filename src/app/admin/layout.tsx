import type { Metadata } from "next";
import { AdminSessionProvider } from "@/components/admin/session-provider";

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</div>
    </AdminSessionProvider>
  );
}
