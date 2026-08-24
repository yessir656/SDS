"use client";

// ============================================================================
// Admin Dashboard — /admin
// Single-page dashboard with three tabs:
//   1. Overview — KPIs + recent activity
//   2. Chemicals — CRUD table for all chemicals
//   3. SDS — Upload / replace / view SDS documents
// ============================================================================

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Beaker,
  FileText,
  LogOut,
  Loader2,
  ExternalLink,
  Users,
  ShieldCheck,
  ScrollText,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminOverview } from "@/components/admin/admin-overview";
import { ChemicalManager } from "@/components/admin/chemical-manager";
import { SdsManager } from "@/components/admin/sds-manager";
import { UserManager } from "@/components/admin/user-manager";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";
import { SystemSettings } from "@/components/admin/system-settings";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  // Defense-in-depth: if there's no session (e.g. middleware bypassed, or
  // session expired client-side), redirect to the login page. Previously this
  // fallback only rendered a static "Redirecting…" message without actually
  // navigating, leaving the user stuck.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
    }
  }, [status, router]);

  // While the session is loading, show a spinner.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-navy-600" />
      </div>
    );
  }

  // If no session, show a spinner while the redirect effect fires.
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-navy-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Image
            src="/dost-mirdc-logo.png"
            alt="DOST-MIRDC"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md object-contain"
            priority
          />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-base font-bold">SDS-CHEM Admin</span>
            <span className="text-[11px] text-muted-foreground">
              {session.user.email}
              {isSuperAdmin && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  SUPER
                </span>
              )}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">View Site</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chemicals" className="gap-2">
              <Beaker className="h-4 w-4" />
              Chemicals
            </TabsTrigger>
            <TabsTrigger value="sds" className="gap-2">
              <FileText className="h-4 w-4" />
              SDS Documents
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="audit" className="gap-2">
                <ScrollText className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="system" className="gap-2">
                <Settings className="h-4 w-4" />
                System
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>
          <TabsContent value="chemicals">
            <ChemicalManager />
          </TabsContent>
          <TabsContent value="sds">
            <SdsManager />
          </TabsContent>
          {isSuperAdmin && (
            <TabsContent value="users">
              <UserManager />
            </TabsContent>
          )}
          {isSuperAdmin && (
            <TabsContent value="audit">
              <AuditLogViewer />
            </TabsContent>
          )}
          {isSuperAdmin && (
            <TabsContent value="system">
              <SystemSettings />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
